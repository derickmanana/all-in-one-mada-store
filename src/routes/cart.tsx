import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMGA } from "@/components/madastore/Money";
import {
  CartItem,
  cartTotal,
  clearCart,
  getCart,
  lineTotal,
  lineUnitWithDiscount,
  updateQty,
} from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [paying, setPaying] = useState(false);

  function reload() {
    setItems(getCart());
  }
  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener("dago-cart-changed", h);
    return () => window.removeEventListener("dago-cart-changed", h);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth/client" });
  }, [authLoading, user, navigate]);

  const total = cartTotal(items);

  async function pay() {
    if (!user) return;
    if (items.length === 0) return toast.error("Panier vide");
    if (!address.trim()) return toast.error("Adresse de livraison requise");
    setPaying(true);
    let ok = 0;
    for (const it of items) {
      const addr = [address, it.color && `Couleur: ${it.color}`, it.size && `Taille: ${it.size}`]
        .filter(Boolean)
        .join(" | ");
      const { error } = await supabase.rpc("place_order", {
        _product_id: it.product_id,
        _quantity: it.qty,
        _address: addr,
      });
      if (error) {
        toast.error(`${it.title}: ${error.message}`);
      } else ok++;
    }
    setPaying(false);
    if (ok > 0) {
      clearCart();
      toast.success(`${ok} commande(s) confirmée(s) 🎉`);
      navigate({ to: "/client" });
    }
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <Link to="/client" className="rounded-lg p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-black">Mon panier ({items.length})</h1>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Panier vide. <Link to="/client" className="text-mada-red font-bold">Continuer mes achats →</Link>
          </div>
        ) : (
          items.map((it, idx) => {
            const discounted = it.qty >= 10;
            const unit = lineUnitWithDiscount(it);
            return (
              <div key={idx} className="flex gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {it.image ? (
                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-2xl">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 text-sm font-bold">{it.title}</div>
                  {(it.color || it.size) && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {it.color && `🎨 ${it.color}`} {it.size && `· 📏 ${it.size}`}
                    </div>
                  )}
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-sm font-black text-mada-red">{formatMGA(unit)}</span>
                    {discounted && (
                      <span className="text-[10px] text-muted-foreground line-through">{formatMGA(it.unit_price_mga)}</span>
                    )}
                  </div>
                  {discounted && (
                    <div className="mt-0.5 inline-block rounded-full bg-mada-green/10 px-2 py-0.5 text-[10px] font-bold text-mada-green">
                      -2% (x{it.qty})
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(idx, it.qty - 1)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-black">{it.qty}</span>
                      <button
                        onClick={() => updateQty(idx, it.qty + 1)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black">{formatMGA(lineTotal(it))}</span>
                      <button
                        onClick={() => updateQty(idx, 0)}
                        className="text-muted-foreground hover:text-mada-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {items.length > 0 && (
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Adresse de livraison"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white px-4 py-3 shadow-2xl">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total</div>
              <div className="text-xl font-black text-mada-red">{formatMGA(total)}</div>
            </div>
            <button
              onClick={pay}
              disabled={paying}
              className="inline-flex items-center gap-2 rounded-full bg-mada-red px-6 py-3 text-sm font-black text-primary-foreground shadow-glow-red disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {paying ? "Paiement..." : "Payer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
