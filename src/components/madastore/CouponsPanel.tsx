import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Clock, CheckCircle2 } from "lucide-react";

type CouponRow = {
  id: string;
  code: string;
  percent: number;
  product_id: string | null;
  category_id: string | null;
  reason: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function CouponsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      await supabase.rpc("grant_loyalty_coupons" as any);
      const { data } = await supabase
        .from("coupons" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!alive) return;
      const list = (data ?? []) as unknown as CouponRow[];
      setRows(list);
      setLoading(false);

      const pids = list.map((c) => c.product_id).filter(Boolean) as string[];
      const cids = list.map((c) => c.category_id).filter(Boolean) as string[];
      const map: Record<string, string> = {};
      if (pids.length) {
        const { data: ps } = await supabase.from("products").select("id,title").in("id", pids);
        (ps ?? []).forEach((p: any) => (map[p.id] = p.title));
      }
      if (cids.length) {
        const { data: cs } = await supabase.from("categories").select("id,name").in("id", cids);
        (cs ?? []).forEach((c: any) => (map[c.id] = c.name));
      }
      if (alive) setNames(map);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Chargement des coupons…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
        <div className="mt-2 text-sm font-bold">Aucun coupon pour le moment</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Parcourez la boutique et passez commande : des coupons de fidélité de 1% à 5% vous sont offerts automatiquement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Vos coupons s'appliquent <strong>automatiquement</strong> au paiement sur le produit ou la catégorie indiqués.
      </p>
      {rows.map((c) => {
        const expired = new Date(c.expires_at).getTime() < Date.now();
        const spent = !!c.used_at;
        const inactive = expired || spent;
        const target = c.product_id
          ? names[c.product_id] ?? "Produit favori"
          : c.category_id
            ? names[c.category_id] ?? "Catégorie favorite"
            : "Tous les produits";
        return (
          <div
            key={c.id}
            className={`flex items-stretch overflow-hidden rounded-2xl border ${
              inactive ? "border-border bg-muted/40 opacity-60" : "border-mada-red/40 bg-card"
            }`}
          >
            <div className={`grid w-24 shrink-0 place-items-center ${inactive ? "bg-muted" : "bg-mada-red text-primary-foreground"}`}>
              <div className="text-center">
                <div className="text-2xl font-black leading-none">-{c.percent}%</div>
                <div className="text-[10px] font-bold uppercase opacity-80">coupon</div>
              </div>
            </div>
            <div className="min-w-0 flex-1 p-3">
              <div className="truncate text-sm font-black">{target}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.code}</div>
              {c.reason && <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{c.reason}</div>}
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold">
                {spent ? (
                  <><CheckCircle2 className="h-3 w-3 text-mada-green" /> Utilisé</>
                ) : expired ? (
                  <><Clock className="h-3 w-3" /> Expiré</>
                ) : (
                  <><Clock className="h-3 w-3 text-mada-green" /> Expire dans {daysLeft(c.expires_at)} j</>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
