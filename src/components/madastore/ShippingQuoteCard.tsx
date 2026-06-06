import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Loader2 } from "lucide-react";
import { getShippingQuote } from "@/lib/shipping.functions";
import { formatMGA } from "./Money";

export type Quote = {
  km: number; fee_mga: number; duration_min: number | null;
  days_min: number; days_max: number; source: string;
};

export function ShippingQuoteCard({
  vendorId, clientLat, clientLng, onQuote,
}: { vendorId: string; clientLat: number | null; clientLng: number | null; onQuote: (q: Quote | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fetchQuote = useServerFn(getShippingQuote);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (!clientLat || !clientLng) return;
      setLoading(true); setErr(null);
      const { data: vp } = await supabase.from("vendor_profiles")
        .select("pickup_lat,pickup_lng,shipping_base_mga,shipping_per_km_mga" as any)
        .eq("id", vendorId).maybeSingle();
      const v = vp as any;
      if (!v?.pickup_lat || !v?.pickup_lng) {
        if (cancelled) return;
        const fb: Quote = { km: 0, fee_mga: Number(v?.shipping_base_mga ?? 5000), duration_min: null, days_min: 2, days_max: 5, source: "default" };
        setQ(fb); onQuote(fb); setLoading(false);
        return;
      }
      try {
        const res = await fetchQuote({
          data: {
            vendor_lat: Number(v.pickup_lat), vendor_lng: Number(v.pickup_lng),
            client_lat: clientLat, client_lng: clientLng,
            base_mga: Number(v.shipping_base_mga ?? 5000),
            per_km_mga: Number(v.shipping_per_km_mga ?? 200),
          },
        });
        if (cancelled) return;
        setQ(res as Quote); onQuote(res as Quote);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Erreur calcul"); onQuote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    go();
    return () => { cancelled = true; };
  }, [vendorId, clientLat, clientLng]);

  if (!clientLat || !clientLng) {
    return <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">⚠️ Sélectionnez une adresse avec GPS pour calculer la livraison.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Truck className="h-3.5 w-3.5 text-mada-green" /> Livraison IA
      </div>
      {loading && <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Calcul en cours...</div>}
      {err && <div className="mt-1 text-xs text-destructive">{err}</div>}
      {q && !loading && (
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div>
            <div className="text-sm font-black text-mada-red">{formatMGA(q.fee_mga)}</div>
            <div className="text-[10px] text-muted-foreground">
              {q.km > 0 && `${q.km} km · `}Livraison estimée: {q.days_min}-{q.days_max} jours
              {q.duration_min ? ` · ~${Math.round(q.duration_min / 60)}h route` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
