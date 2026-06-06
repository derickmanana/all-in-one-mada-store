import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Crosshair, Loader2, X } from "lucide-react";
import { inMadagascar, loadGoogleMaps, parseAddressComponents } from "@/lib/maps";

export type AddressRow = {
  id?: string;
  full_name: string;
  phone: string;
  province: string;
  region?: string | null;
  district?: string | null;
  city?: string | null;
  quartier: string;
  street: string;
  details?: string | null;
  latitude: number;
  longitude: number;
  formatted_address?: string | null;
  is_default?: boolean;
};

const EMPTY: AddressRow = {
  full_name: "", phone: "", province: "", quartier: "", street: "",
  latitude: -18.8792, longitude: 47.5079, // Antananarivo
  is_default: false,
};

export function AddressForm({
  initial, userId, onClose, onSaved,
}: { initial?: AddressRow; userId: string; onClose: () => void; onSaved: (a: AddressRow) => void }) {
  const [a, setA] = useState<AddressRow>(initial ?? { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [busyGeo, setBusyGeo] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps().then((g) => {
      if (!mounted || !mapEl.current) return;
      const map = new g.maps.Map(mapEl.current, {
        center: { lat: a.latitude, lng: a.longitude },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        restriction: {
          latLngBounds: { south: -25.7, west: 42.5, north: -11.8, east: 51.0 },
          strictBounds: false,
        },
      });
      const marker = new g.maps.Marker({
        map, position: { lat: a.latitude, lng: a.longitude }, draggable: true,
      });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (!p) return;
        const lat = p.lat(), lng = p.lng();
        if (!inMadagascar(lat, lng)) { toast.error("Hors Madagascar"); marker.setPosition({ lat: a.latitude, lng: a.longitude }); return; }
        setA((x) => ({ ...x, latitude: lat, longitude: lng }));
        reverseGeocode(g, lat, lng);
      });
      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        if (!inMadagascar(lat, lng)) return toast.error("Hors Madagascar");
        marker.setPosition({ lat, lng });
        setA((x) => ({ ...x, latitude: lat, longitude: lng }));
        reverseGeocode(g, lat, lng);
      });
      mapRef.current = map;
      markerRef.current = marker;

      // Autocomplete (Places legacy widget for simplicity)
      if (inputEl.current && g.maps.places?.Autocomplete) {
        const ac = new g.maps.places.Autocomplete(inputEl.current, {
          componentRestrictions: { country: "mg" },
          fields: ["geometry", "formatted_address", "address_components", "name"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.geometry?.location) return;
          const lat = place.geometry.location.lat(), lng = place.geometry.location.lng();
          if (!inMadagascar(lat, lng)) return toast.error("Hors Madagascar");
          const parts = parseAddressComponents(place.address_components ?? []);
          setA((x) => ({
            ...x, latitude: lat, longitude: lng,
            formatted_address: place.formatted_address ?? place.name,
            province: parts.province ?? x.province,
            region: parts.region ?? x.region,
            district: parts.district ?? x.district,
            city: parts.city ?? x.city,
            quartier: parts.quartier ?? x.quartier,
            street: parts.street || x.street,
          }));
          map.panTo({ lat, lng }); map.setZoom(15);
          marker.setPosition({ lat, lng });
        });
      }
    }).catch((e) => {
      console.error(e); toast.error("Carte indisponible");
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverseGeocode(g: any, lat: number, lng: number) {
    try {
      const geo = new g.maps.Geocoder();
      const res: any = await geo.geocode({ location: { lat, lng } });
      const r = res.results?.[0];
      if (r) {
        const parts = parseAddressComponents(r.address_components ?? []);
        setA((x) => ({
          ...x,
          formatted_address: r.formatted_address,
          province: parts.province ?? x.province,
          region: parts.region ?? x.region,
          district: parts.district ?? x.district,
          city: parts.city ?? x.city,
          quartier: parts.quartier ?? x.quartier,
          street: parts.street || x.street,
        }));
      }
    } catch (e) { console.warn(e); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("GPS non disponible");
    setBusyGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusyGeo(false);
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (!inMadagascar(lat, lng)) return toast.error("❌ Service disponible uniquement à Madagascar");
        setA((x) => ({ ...x, latitude: lat, longitude: lng }));
        if (mapRef.current && markerRef.current) {
          mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(15);
          markerRef.current.setPosition({ lat, lng });
          loadGoogleMaps().then((g) => reverseGeocode(g, lat, lng));
        }
      },
      () => { setBusyGeo(false); toast.error("Permission GPS refusée"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    if (!a.full_name.trim() || !a.phone.trim() || !a.province.trim() || !a.quartier.trim() || !a.street.trim()) {
      return toast.error("Tous les champs obligatoires doivent être remplis");
    }
    if (!inMadagascar(a.latitude, a.longitude)) return toast.error("GPS hors Madagascar");
    setSaving(true);
    const payload = { ...a, user_id: userId };
    const { data, error } = a.id
      ? await supabase.from("addresses" as any).update(payload).eq("id", a.id).select().single()
      : await supabase.from("addresses" as any).insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Adresse enregistrée ✅");
    onSaved(data as any);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-card border border-border">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h3 className="font-black">📍 {a.id ? "Modifier" : "Nouvelle"} adresse</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 p-4">
          <input ref={inputEl} placeholder="🔎 Rechercher quartier, rue à Madagascar..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />

          <div ref={mapEl} className="h-64 w-full rounded-xl border border-border bg-muted" />

          <button onClick={useMyLocation} disabled={busyGeo}
            className="inline-flex items-center gap-2 rounded-full bg-mada-green px-4 py-2 text-xs font-black text-secondary-foreground">
            {busyGeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            Choisir ma position
          </button>

          <div className="grid grid-cols-2 gap-2">
            <input value={a.full_name} onChange={(e) => setA({ ...a, full_name: e.target.value })} placeholder="Nom complet *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value })} placeholder="Téléphone *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.province} onChange={(e) => setA({ ...a, province: e.target.value })} placeholder="Province *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.region ?? ""} onChange={(e) => setA({ ...a, region: e.target.value })} placeholder="Région" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.district ?? ""} onChange={(e) => setA({ ...a, district: e.target.value })} placeholder="District" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.city ?? ""} onChange={(e) => setA({ ...a, city: e.target.value })} placeholder="Ville" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.quartier} onChange={(e) => setA({ ...a, quartier: e.target.value })} placeholder="Quartier *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={a.street} onChange={(e) => setA({ ...a, street: e.target.value })} placeholder="Rue *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <textarea value={a.details ?? ""} onChange={(e) => setA({ ...a, details: e.target.value })} placeholder="Détails (étage, point de repère...)" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!a.is_default} onChange={(e) => setA({ ...a, is_default: e.target.checked })} />
            Adresse principale
          </label>

          <div className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
          </div>

          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
