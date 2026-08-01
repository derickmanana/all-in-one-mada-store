import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Loader2 } from "lucide-react";
import { formatMGA } from "./Money";

export type Quote = {
  km: number;
  fee_mga: number;
  duration_min: number | null;
  days_min: number;
  days_max: number;
  source: string;
  zone_label?: string | null;
};

/**
 * Frais de livraison détectés automatiquement à partir de la province/région/ville
 * de l'adresse du client. La grille tarifaire du vendeur n'est jamais exposée.
 */
export function ShippingQuoteCard({
  vendorId,
  addressId,
  onQuote,
}: {
  vendorId: string;
  addressId: string | null;
  onQuote: (q: Quote | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    supabase
      .from("vendor_profiles")
      .select("shop_name")
      .eq("id", vendorId)
      .maybeSingle()
      .then(({ data }) => setShopName(data?.shop_name ?? ""));
  }, [vendorId]);

  useEffect(() => {
    let cancelled = false;
    if (!addressId) {
      setQ(null);
      onQuote(null);
      return;
    }
    setLoading(true);
    setErr(null);
    supabase
      .rpc("vendor_zone_fee" as any, { _vendor_id: vendorId, _address_id: addressId } as any)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setErr("Frais indisponibles");
          onQuote(null);
          return;
        }
        const res: any = data ?? {};
        const full: Quote = {
          km: 0,
          fee_mga: Number(res.fee_mga ?? 0),
          duration_min: null,
          days_min: 2,
          days_max: 5,
          source: res.matched ? "zone" : "base",
          zone_label: null,
        };
        setQ(full);
        onQuote(full);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, addressId]);

  if (!addressId) {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
        ⚠️ Sélectionnez une adresse de livraison.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Truck className="h-3.5 w-3.5 text-mada-green" /> Livraison {shopName && `· ${shopName}`}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Détection de votre zone...
        </div>
      )}
      {err && <div className="text-xs text-destructive">{err}</div>}
      {q && !loading && (
        <div>
          <div className="text-sm font-black text-mada-red">{formatMGA(q.fee_mga)}</div>
          <div className="text-[10px] text-muted-foreground">
            Tarif automatique selon votre zone · Livraison estimée {q.days_min}-{q.days_max} jours
          </div>
        </div>
      )}
    </div>
  );
}
