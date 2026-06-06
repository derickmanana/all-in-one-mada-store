import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crosshair, MapPin, Loader2, Save } from "lucide-react";
import { inMadagascar, loadGoogleMaps, parseAddressComponents } from "@/lib/maps";

type Pickup = {
  pickup_province: string | null;
  pickup_region: string | null;
  pickup_city: string | null;
  pickup_quartier: string | null;
  pickup_street: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  shipping_base_mga: number;
  shipping_per_km_mga: number;
};

const DEFAULT: Pickup = {
  pickup_province: "", pickup_region: "", pickup_city: "", pickup_quartier: "", pickup_street: "",
  pickup_lat: -18.8792, pickup_lng: 47.5079,
  shipping_base_mga: 5000, shipping_per_km_mga: 200,
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
    supabase.from("vendor_profiles").select("pickup_province,pickup_region,pickup_city,pickup_quartier,pickup_street,pickup_lat,pickup_lng,shipping_base_mga,shipping_per_km_mga" as any)
      .eq("id", vendorId).maybeSingle().then(({ data }) => { if (data) setP({ ...DEFAULT, ...(data as any) }); });
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

  // Sync marker when p.pickup_lat/lng change externally (after data load)
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

  async function save() {
    if (!p.pickup_lat || !p.pickup_lng) return toast.error("Position GPS requise");
    setSaving(true);
    const { error } = await supabase.from("vendor_profiles").update(p as any).eq("id", vendorId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Position vendeur enregistrée ✅");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="font-black flex items-center gap-2"><MapPin className="h-4 w-4 text-mada-red" /> Adresse de livraison vendeur</h3>
      <p className="text-xs text-muted-foreground">L'IA utilise votre position pour calculer la distance réelle et les frais de livraison vers chaque client.</p>

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
        <div className="text-xs font-bold uppercase text-muted-foreground">💰 Tarifs livraison (de base)</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Frais de base (MGA)</span>
            <input type="number" value={p.shipping_base_mga} onChange={(e) => setP({ ...p, shipping_base_mga: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Prix par km (MGA)</span>
            <input type="number" value={p.shipping_per_km_mga} onChange={(e) => setP({ ...p, shipping_per_km_mga: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <p className="text-[10px] text-muted-foreground">L'IA ajustera automatiquement selon la distance réelle vendeur ↔ client.</p>
      </div>

      <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
        <Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  );
}
