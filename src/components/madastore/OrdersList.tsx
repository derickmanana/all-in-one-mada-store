import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA } from "./Money";

type Order = {
  id: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  total_mga: number;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  paye: "Payée",
  expedie: "Expédiée",
  livre: "Livrée",
  annule: "Annulée",
  rembourse: "Remboursée",
};

const STATUS_COLORS: Record<string, string> = {
  en_attente: "bg-yellow-100 text-yellow-800",
  paye: "bg-blue-100 text-blue-800",
  expedie: "bg-purple-100 text-purple-800",
  livre: "bg-mada-green/15 text-mada-green",
  annule: "bg-destructive/15 text-destructive",
  rembourse: "bg-muted text-muted-foreground",
};

export function OrdersList({ userId, role }: { userId: string; role: "client" | "vendeur" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const col = role === "client" ? "client_id" : "vendor_id";
    const { data } = await supabase
      .from("orders")
      .select("id, product_title, product_image, quantity, total_mga, status, created_at")
      .eq(col, userId)
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [userId, role]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Aucune commande {role === "client" ? "passée" : "reçue"}.
      </div>
    );

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
            {o.product_image ? <img src={o.product_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">📦</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="line-clamp-2 text-sm font-bold">{o.product_title}</div>
            <div className="text-xs text-muted-foreground">Qté: {o.quantity} · {new Date(o.created_at).toLocaleDateString("fr-FR")}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-black text-mada-red">{formatMGA(o.total_mga)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
            </div>
            {role === "vendeur" && o.status === "paye" && (
              <button onClick={() => updateStatus(o.id, "expedie")} className="mt-2 rounded-lg bg-mada-green px-3 py-1 text-xs font-bold text-secondary-foreground">
                Marquer expédiée
              </button>
            )}
            {role === "vendeur" && o.status === "expedie" && (
              <button onClick={() => updateStatus(o.id, "livre")} className="mt-2 rounded-lg bg-mada-green px-3 py-1 text-xs font-bold text-secondary-foreground">
                Marquer livrée
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
