import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crosshair, MapPin, Loader2, Save, Plus, X } from "lucide-react";
import { inMadagascar, loadGoogleMaps, parseAddressComponents } from "@/lib/maps";
import { formatMGA } from "./Money";

type ZoneKind = "province" | "region" | "city";
type Zone = { kind: ZoneKind; label: string; fee_mga: number };
const ZONE_KINDS: { id: ZoneKind; label: string }[] = [
  { id: "province", label: "Province" },
  { id: "region", label: "Région" },
  { id: "city", label: "Zone / Ville" },
];
function parseZone(z: any): Zone {
  const kind: ZoneKind = z?.province ? "province" : z?.region ? "region" : "city";
  return {
    kind,
    label: String(z?.province ?? z?.region ?? z?.city ?? z?.label ?? ""),
    fee_mga: Number(z?.fee_mga ?? 0),
  };
}

type Pickup = {
  pickup_province: string | null;
  pickup_region: string | null;
  pickup_city: string | null;
  pickup_quartier: string | null;
  pickup_street: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  shipping_base_mga: number;
  shipping_zones: Zone[];
};

const DEFAULT: Pickup = {
  pickup_province: "", pickup_region: "", pickup_city: "", pickup_quartier: "", pickup_street: "",
  pickup_lat: -18.8792, pickup_lng: 47.5079,
  shipping_base_mga: 5000, shipping_zones: [],
};

export function VendorPickupForm({ vendorId }: { vendorId: string }) {
  const [p, setP] = useState<Pickup>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    supabase.from("vendor_profiles").select("pickup_province,pickup_region,pickup_city,pickup_quartier,pickup_street,pickup_lat,pickup_lng,shipping_base_mga,shipping_zones" as any)
      .eq("id", vendorId).maybeSingle().then(({ data }) => {
        if (data) {
          const d: any = data;
          setP({
            ...DEFAULT,
            ...d,
            shipping_zones: Array.isArray(d.shipping_zones) ? d.shipping_zones.map(parseZone) : [],
          });
        }
      });
  }, [vendorId]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps().then((g) => {
      if (!mounted || !mapEl.current) return;
      const map = new g.maps.Map(mapEl.current, {
        center: { lat: p.pickup_lat ?? -18.8792, lng: p.pickup_lng ?? 47.5079 },
        zoom: 13, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      const marker = new g.maps.Marker({ map, position: map.getCenter(), draggable: true });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition(); if (!pos) return;
        const lat = pos.lat(), lng = pos.lng();
        if (!inMadagascar(lat, lng)) return toast.error("Hors Madagascar");
        setP((x) => ({ ...x, pickup_lat: lat, pickup_lng: lng }));
      });
      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        if (!inMadagascar(lat, lng)) return toast.error("Hors Madagascar");
        marker.setPosition({ lat, lng });
        setP((x) => ({ ...x, pickup_lat: lat, pickup_lng: lng }));
      });
      mapRef.current = map; markerRef.current = marker;

      if (inputEl.current && g.maps.places?.Autocomplete) {
        const ac = new g.maps.places.Autocomplete(inputEl.current, {
          componentRestrictions: { country: "mg" },
          fields: ["geometry", "formatted_address", "address_components"],
        });
        ac.addListener("place_changed", () => {
          const pl = ac.getPlace();
          if (!pl.geometry?.location) return;
          const lat = pl.geometry.location.lat(), lng = pl.geometry.location.lng();
          if (!inMadagascar(lat, lng)) return toast.error("Hors Madagascar");
          const parts = parseAddressComponents(pl.address_components ?? []);
          setP((x) => ({
            ...x, pickup_lat: lat, pickup_lng: lng,
            pickup_province: parts.province ?? x.pickup_province,
            pickup_region: parts.region ?? x.pickup_region,
            pickup_city: parts.city ?? x.pickup_city,
            pickup_quartier: parts.quartier ?? x.pickup_quartier,
            pickup_street: parts.street || x.pickup_street,
          }));
          map.panTo({ lat, lng }); map.setZoom(15); marker.setPosition({ lat, lng });
        });
      }
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && markerRef.current && p.pickup_lat && p.pickup_lng) {
      const pos = { lat: p.pickup_lat, lng: p.pickup_lng };
      markerRef.current.setPosition(pos); mapRef.current.panTo(pos);
    }
  }, [p.pickup_lat, p.pickup_lng]);

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("GPS indisponible");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (!inMadagascar(lat, lng)) return toast.error("❌ Service uniquement Madagascar");
        setP((x) => ({ ...x, pickup_lat: lat, pickup_lng: lng }));
      },
      () => { setBusy(false); toast.error("Permission refusée"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function addZone() {
    setP((x) => ({ ...x, shipping_zones: [...x.shipping_zones, { kind: "province" as ZoneKind, label: "", fee_mga: 0 }] }));
  }
  function updateZone(i: number, patch: Partial<Zone>) {
    setP((x) => ({ ...x, shipping_zones: x.shipping_zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)) }));
  }
  function removeZone(i: number) {
    setP((x) => ({ ...x, shipping_zones: x.shipping_zones.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!p.pickup_lat || !p.pickup_lng) return toast.error("Position GPS requise");
    if (p.shipping_base_mga < 0) return toast.error("Frais de base invalide");
    const cleanedZones = p.shipping_zones
      .filter((z) => z.label.trim() && z.fee_mga >= 0)
      .map((z) => ({ [z.kind]: z.label.trim(), label: z.label.trim(), fee_mga: Math.round(z.fee_mga) }));

    setSaving(true);
    const payload: any = { ...p, shipping_zones: cleanedZones };
    // keep legacy column at 0 to disable km-based auto calc
    payload.shipping_per_km_mga = 0;
    const { error } = await supabase.from("vendor_profiles").update(payload).eq("id", vendorId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Position et tarifs enregistrés ✅");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="font-black flex items-center gap-2"><MapPin className="h-4 w-4 text-mada-red" /> Adresse de livraison vendeur</h3>
      <p className="text-xs text-muted-foreground">Le GPS sert uniquement à localiser votre boutique et suivre les colis. Vous fixez vous-même les frais ci-dessous.</p>

      <input ref={inputEl} placeholder="🔎 Rechercher mon adresse..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div ref={mapEl} className="h-56 w-full rounded-xl border border-border bg-muted" />
      <button onClick={useMyLocation} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-mada-green px-4 py-2 text-xs font-black text-secondary-foreground">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Choisir ma position
      </button>

      <div className="grid grid-cols-2 gap-2">
        <input value={p.pickup_province ?? ""} onChange={(e) => setP({ ...p, pickup_province: e.target.value })} placeholder="Province" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={p.pickup_region ?? ""} onChange={(e) => setP({ ...p, pickup_region: e.target.value })} placeholder="Région" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={p.pickup_city ?? ""} onChange={(e) => setP({ ...p, pickup_city: e.target.value })} placeholder="Ville" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={p.pickup_quartier ?? ""} onChange={(e) => setP({ ...p, pickup_quartier: e.target.value })} placeholder="Quartier" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={p.pickup_street ?? ""} onChange={(e) => setP({ ...p, pickup_street: e.target.value })} placeholder="Rue" className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-xs font-bold uppercase text-muted-foreground">💰 Frais de livraison (manuels)</div>

        <label className="block">
          <span className="text-[10px] text-muted-foreground">Frais par défaut / forfait (MGA)</span>
          <input
            type="number"
            value={p.shipping_base_mga}
            onChange={(e) => setP({ ...p, shipping_base_mga: Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">Ce montant est appliqué si vous n'ajoutez aucune zone.</span>
        </label>

        <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase">Tarifs par Province / Région / Zone</div>
            <button type="button" onClick={addZone} className="inline-flex items-center gap-1 rounded-full bg-mada-green px-2 py-1 text-[10px] font-black text-secondary-foreground">
              <Plus className="h-3 w-3" /> Tarif
            </button>
          </div>
          {p.shipping_zones.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Ex : Province « Antananarivo » — 5 000 MGA. Le tarif est appliqué automatiquement selon l'adresse du client ; votre grille reste invisible pour lui.
            </p>
          )}
          {p.shipping_zones.map((z, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={z.kind}
                onChange={(e) => updateZone(i, { kind: e.target.value as ZoneKind })}
                className="w-24 rounded-lg border border-border bg-background px-1 py-1.5 text-xs"
              >
                {ZONE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <input
                value={z.label}
                onChange={(e) => updateZone(i, { label: e.target.value })}
                placeholder="Nom exact"
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                type="number"
                value={z.fee_mga || ""}
                onChange={(e) => updateZone(i, { fee_mga: Number(e.target.value) })}
                placeholder="MGA"
                className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              <button type="button" onClick={() => removeZone(i)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {p.shipping_zones.length > 0 && (
            <div className="pt-1 text-[10px] text-muted-foreground">
              Aperçu : {p.shipping_zones.map((z) => `${ZONE_KINDS.find((k) => k.id === z.kind)?.label} ${z.label || "?"} = ${formatMGA(z.fee_mga)}`).join(" · ")}
            </div>
          )}

        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
        <Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  );
}
