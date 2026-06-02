import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathForRole } from "@/lib/auth";
import { formatMGA } from "@/components/madastore/Money";
import { ArrowLeft, MessageCircle, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [p, setP] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [address, setAddress] = useState("");
  const [buying, setBuying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      setP(data);
      if (data) {
        const { data: v } = await supabase.from("vendor_profiles").select("id, shop_name, phone").eq("id", data.vendor_id).maybeSingle();
        setVendor(v);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth/client" });
  }, [authLoading, user, navigate]);

  async function buy() {
    if (!user) return;
    if (!address.trim()) return toast.error("Adresse de livraison requise");
    setBuying(true);
    const { error } = await supabase.rpc("place_order", { _product_id: id, _quantity: qty, _address: address });
    setBuying(false);
    if (error) {
      const msg = error.message.includes("insufficient balance")
        ? "Solde insuffisant. Rechargez votre wallet."
        : error.message.includes("insufficient stock")
        ? "Stock insuffisant."
        : error.message;
      return toast.error(msg);
    }
    toast.success("Commande confirmée 🎉");
    navigate({ to: "/client" });
  }

  async function contactSeller() {
    if (!user || !vendor) return;
    const { data: existing } = await supabase
      .from("conversations").select("id").eq("client_id", user.id).eq("vendor_id", vendor.id).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").insert({ client_id: user.id, vendor_id: vendor.id });
    }
    navigate({ to: dashboardPathForRole(role) });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Chargement...</div></div>;
  if (!p) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Produit introuvable.</div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <Link to={dashboardPathForRole(role)} className="rounded-lg p-1 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-sm font-black truncate">{p.title}</h1>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="overflow-hidden rounded-3xl bg-muted aspect-square">
          {p.images?.[imgIdx] ? <img src={p.images[imgIdx]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl">📦</div>}
        </div>
        {p.images?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {p.images.map((u: string, i: number) => (
              <button key={i} onClick={() => setImgIdx(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? "border-mada-red" : "border-transparent"}`}>
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="text-3xl font-black text-mada-red">{formatMGA(p.price_mga)}</div>
          {p.price_usdt && <div className="text-sm text-muted-foreground">≈ {p.price_usdt} USDT</div>}
          <h2 className="mt-2 text-lg font-bold">{p.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
          <div className="mt-2 text-xs">Stock: <strong>{p.stock}</strong></div>
        </div>

        {vendor && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Vendeur</div>
              <div className="font-bold text-sm">{vendor.shop_name}</div>
            </div>
            <button onClick={contactSeller} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold">
              <MessageCircle className="h-3 w-3" /> Contacter
            </button>
          </div>
        )}

        {role === "client" && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold">Quantité</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-lg border border-border font-black">-</button>
                <span className="w-8 text-center font-black">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(p.stock, q + 1))} className="h-8 w-8 rounded-lg border border-border font-black">+</button>
              </div>
            </div>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse de livraison" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">Total</span>
              <span className="font-black text-lg text-mada-red">{formatMGA(p.price_mga * qty)}</span>
            </div>
            <button onClick={buy} disabled={buying || p.stock === 0} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <ShoppingBag className="h-4 w-4" /> {buying ? "Achat en cours..." : p.stock === 0 ? "Rupture de stock" : "Acheter avec mon wallet"}
            </button>
            <p className="text-[10px] text-center text-muted-foreground">Le montant sera débité instantanément de votre wallet interne. Rechargez d'abord si nécessaire.</p>
          </div>
        )}
      </div>
    </div>
  );
}
