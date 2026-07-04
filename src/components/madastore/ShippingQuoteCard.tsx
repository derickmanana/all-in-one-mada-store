import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Loader2 } from "lucide-react";
import { getShippingQuote } from "@/lib/shipping.functions";
import { formatMGA } from "./Money";

export type Quote = {
  km: number; fee_mga: number; duration_min: number | null;
  days_min: number; days_max: number; source: string;
  zone_label?: string | null;
};

type Zone = { label: string; fee_mga: number };

export function ShippingQuoteCard({
  vendorId, clientLat, clientLng, onQuote,
}: { vendorId: string; clientLat: number | null; clientLng: number | null; onQuote: (q: Quote | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [baseFee, setBaseFee] = useState<number>(0);
  const [selectedZone, setSelectedZone] = useState<number>(-1); // -1 = base/default
  const [vendorPos, setVendorPos] = useState<{ lat: number; lng: number } | null>(null);
  const fetchQuote = useServerFn(getShippingQuote);

  // Load vendor pricing (flat + optional zones)
  useEffect(() => {
    let cancelled = false;
    supabase.from("vendor_profiles")
      .select("pickup_lat,pickup_lng,shipping_base_mga,shipping_zones" as any)
      .eq("id", vendorId).maybeSingle().then(({ data }) => {
        if (cancelled || !data) return;
        const v: any = data;
        setBaseFee(Number(v.shipping_base_mga ?? 5000));
        setZones(Array.isArray(v.shipping_zones) ? v.shipping_zones : []);
        if (v.pickup_lat && v.pickup_lng) setVendorPos({ lat: Number(v.pickup_lat), lng: Number(v.pickup_lng) });
      });
    return () => { cancelled = true; };
  }, [vendorId]);

  // Compute quote whenever selection / position changes
  useEffect(() => {
    let cancelled = false;
    async function go() {
      const fee = selectedZone >= 0 && zones[selectedZone] ? zones[selectedZone].fee_mga : baseFee;
      const zoneLabel = selectedZone >= 0 && zones[selectedZone] ? zones[selectedZone].label : null;

      if (!clientLat || !clientLng || !vendorPos) {
        const fb: Quote = { km: 0, fee_mga: fee, duration_min: null, days_min: 2, days_max: 5, source: "manual", zone_label: zoneLabel };
        setQ(fb); onQuote(fb);
        return;
      }
      setLoading(true); setErr(null);
      try {
        const res = await fetchQuote({
          data: {
            vendor_lat: vendorPos.lat, vendor_lng: vendorPos.lng,
            client_lat: clientLat, client_lng: clientLng,
            base_mga: fee,
          },
        });
        if (cancelled) return;
        const full: Quote = { ...(res as any), zone_label: zoneLabel };
        setQ(full); onQuote(full);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Erreur calcul"); onQuote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    go();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorPos, clientLat, clientLng, baseFee, zones, selectedZone]);

  if (!clientLat || !clientLng) {
    return <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">⚠️ Sélectionnez une adresse avec GPS pour la livraison.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Truck className="h-3.5 w-3.5 text-mada-green" /> Livraison
      </div>

      {zones.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Choisir votre zone</div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setSelectedZone(-1)}
              className={`rounded-full border px-2 py-1 text-[11px] font-bold ${selectedZone === -1 ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border"}`}
            >
              Par défaut · {formatMGA(baseFee)}
            </button>
            {zones.map((z, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedZone(i)}
                className={`rounded-full border px-2 py-1 text-[11px] font-bold ${selectedZone === i ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border"}`}
              >
                {z.label} · {formatMGA(z.fee_mga)}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Calcul en cours...</div>}
      {err && <div className="text-xs text-destructive">{err}</div>}
      {q && !loading && (
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-sm font-black text-mada-red">{formatMGA(q.fee_mga)}</div>
            <div className="text-[10px] text-muted-foreground">
              {q.zone_label ? `Zone: ${q.zone_label} · ` : ""}
              {q.km > 0 && `${q.km} km · `}
              Livraison estimée: {q.days_min}-{q.days_max} jours
              {q.duration_min ? ` · ~${Math.round(q.duration_min / 60)}h route` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
