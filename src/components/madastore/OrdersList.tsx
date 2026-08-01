import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA } from "./Money";
import { ShippingModal } from "./ShippingModal";

type Order = {
  id: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  total_mga: number;
  status: string;
  created_at: string;
  vendor_released?: boolean;
  buyer_confirmed_at?: string | null;
  auto_release_at?: string | null;
  tracking_status?: string | null;
  shipping_address?: string | null;
  tracking_code?: string | null;
  client_hidden?: boolean;
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
const TRACK_LABEL: Record<string, string> = {
  prepare: "📦 Préparé",
  prepared: "📦 Colis préparé",
  shipped: "🚚 Départ",
  in_transit: "🛣️ En route",
  nearby: "📍 À proximité",
  at_depot: "🏢 En dépôt",
  arrived: "📍 Arrivé",
  delivered: "🏠 Livré",
  cancelled: "❌ Annulé",
};
const VENDOR_STEPS: { id: string; label: string }[] = [
  { id: "prepared", label: "📦 Préparé" },
  { id: "shipped", label: "🚚 Départ" },
  { id: "in_transit", label: "🛣️ En route" },
  { id: "nearby", label: "📍 À proximité" },
  { id: "at_depot", label: "🏢 En dépôt" },
  { id: "delivered", label: "🏠 Livré" },
  { id: "cancelled", label: "❌ Annuler" },
];


export function OrdersList({ userId, role }: { userId: string; role: "client" | "vendeur" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);

  async function load() {
    setLoading(true);
    const col = role === "client" ? "client_id" : "vendor_id";
    let req = supabase
      .from("orders")
      .select("id, product_title, product_image, quantity, total_mga, status, created_at, vendor_released, buyer_confirmed_at, auto_release_at, tracking_status, shipping_address, tracking_code, client_hidden" as any)
      .eq(col, userId)
      .order("created_at", { ascending: false });
    if (role === "client") req = req.eq("client_hidden", false);
    const { data } = await req;
    setOrders((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, [userId, role]);

  // Realtime sync: refresh list on any change to orders touching this user
  useEffect(() => {
    const col = role === "client" ? "client_id" : "vendor_id";
    const ch = supabase
      .channel(`orders-${role}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `${col}=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role]);

  async function setTracking(id: string, status: string) {
    if (status === "cancelled" && !confirm("Annuler la livraison de cette commande ?")) return;
    const { error } = await supabase.rpc("vendor_set_tracking" as any, { _order_id: id, _status: status } as any);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    load();
  }

  async function markInTransit(id: string) {

    const { error } = await supabase.rpc("vendor_mark_in_transit" as any, { _order_id: id });
    if (error) return toast.error(error.message);
    toast.success("En cours de livraison 🛣️");
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Qté: {o.quantity} · {new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
              {o.tracking_code && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(o.tracking_code!); toast.success("Numéro copié"); }}
                  className="rounded bg-mada-green/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-mada-green"
                  title="Copier le numéro de suivi"
                >
                  #{o.tracking_code}
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm font-black text-mada-red">{formatMGA(o.total_mga)}</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                {o.tracking_status && o.tracking_status !== "prepare" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{TRACK_LABEL[o.tracking_status] ?? o.tracking_status}</span>
                )}
              </div>
            </div>

            {/* Vendor actions */}
            {role === "vendeur" && o.status === "paye" && !o.tracking_status?.match(/shipped|in_transit|nearby|at_depot|delivered/) && (
              <button onClick={() => setShipOrder(o)} className="mt-2 rounded-lg bg-mada-green px-3 py-1 text-xs font-bold text-secondary-foreground">
                🚚 Expédier
              </button>
            )}
            {role === "vendeur" && (
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Statut du colis</div>
                <div className="flex flex-wrap gap-1">
                  {VENDOR_STEPS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setTracking(o.id, s.id)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                        o.tracking_status === s.id
                          ? "border-mada-red bg-mada-red text-primary-foreground"
                          : "border-border bg-white hover:border-mada-red"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {/* Tracking link for both */}
            {(o.status === "expedie" || o.status === "livre" || o.tracking_status === "in_transit") && (
              <Link to="/order/$id/tracking" params={{ id: o.id }} className="mt-2 ml-2 inline-block text-xs font-bold text-mada-green underline">
                🚚 Suivi de livraison
              </Link>
            )}

            {/* Client confirm reception */}
            {role === "client" && !o.vendor_released && (o.status === "expedie" || o.status === "livre" || o.status === "paye") && (
              <button
                onClick={async () => {
                  const { error } = await supabase.rpc("confirm_delivery" as any, { _order_id: o.id });
                  if (error) return toast.error(error.message);
                  toast.success("Merci ! Le vendeur sera payé ✅");
                  load();
                }}
                className="mt-2 ml-2 rounded-lg bg-mada-green px-3 py-1 text-xs font-bold text-secondary-foreground"
              >
                ✅ Produit reçu
              </button>
            )}
            {o.vendor_released && <div className="mt-1 text-[10px] font-bold text-mada-green">Fonds vendeur débloqués</div>}
            {role === "vendeur" && !o.vendor_released && o.auto_release_at && (
              <div className="mt-1 text-[10px] text-muted-foreground">Auto-libération: {new Date(o.auto_release_at).toLocaleDateString("fr-FR")}</div>
            )}
            {role === "client" && (o.status === "livre" || o.status === "annule" || o.status === "rembourse") && (
              <button
                onClick={async () => {
                  if (!confirm("Masquer cette commande de votre historique ?")) return;
                  const { error } = await supabase.from("orders").update({ client_hidden: true } as any).eq("id", o.id);
                  if (error) return toast.error(error.message);
                  toast.success("Commande masquée");
                  load();
                }}
                className="mt-2 ml-2 text-[10px] font-bold text-muted-foreground hover:text-destructive underline"
              >
                🗑️ Supprimer de l'historique
              </button>
            )}
          </div>
        </div>
      ))}

      {shipOrder && <ShippingModal order={shipOrder} onClose={() => setShipOrder(null)} onDone={load} />}
    </div>
  );
}
