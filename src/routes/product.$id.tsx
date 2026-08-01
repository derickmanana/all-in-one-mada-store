import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathForRole } from "@/lib/auth";
import { formatMGA, formatUSDT } from "@/components/madastore/Money";
import { addToCart } from "@/lib/cart";
import { AddressSelector } from "@/components/madastore/AddressSelector";
import { ShippingQuoteCard, type Quote } from "@/components/madastore/ShippingQuoteCard";
import type { AddressRow } from "@/components/madastore/AddressForm";
import { ArrowLeft, MessageCircle, ShoppingBag, Heart, Send, ShoppingCart, X, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

type Variant = { image_index: number; price_mga: number; colors: string[]; sizes: string[]; units?: string[]; custom?: string };
type Comment = { id: string; user_id: string; author_name: string | null; content: string; created_at: string };

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [p, setP] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // Popup state
  const [popup, setPopup] = useState<null | "cart" | "buy">(null);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      setP(data);
      if (data) {
        const { data: v } = await supabase.from("vendor_profiles").select("id, shop_name, phone").eq("id", data.vendor_id).maybeSingle();
        setVendor(v);
        supabase.rpc("increment_product_view" as any, { _product_id: id } as any).then(() => {});
      }
      setLoading(false);
    })();
  }, [id]);

  async function reloadEngagement() {
    const [{ data: l, count }, { data: c }] = await Promise.all([
      supabase.from("product_likes").select("user_id", { count: "exact" }).eq("product_id", id),
      supabase.from("product_comments").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setLikes(count ?? 0);
    setLiked(!!l?.find((x: any) => x.user_id === user?.id));
    setComments((c ?? []) as Comment[]);
  }

  useEffect(() => {
    if (p) reloadEngagement();
  }, [p, user]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth/client" });
  }, [authLoading, user, navigate]);

  const variants: Variant[] = Array.isArray(p?.variants) ? p.variants : [];
  const currentVariant = variants.find((v) => v.image_index === imgIdx) ?? variants[0];
  const basePrice = currentVariant?.price_mga ?? p?.price_mga ?? 0;
  const promoPct =
    p?.discount_percent > 0 && (!p?.promo_until || new Date(p.promo_until) > new Date()) ? p.discount_percent : 0;
  const displayPrice = promoPct ? Math.floor((basePrice * (100 - promoPct)) / 100) : basePrice;
  const discounted = qty >= 10;
  const effUnit = discounted ? Math.floor(displayPrice * 0.98) : displayPrice;


  function openPopup(mode: "cart" | "buy") {
    setQty(1);
    setColor(null);
    setSize(null);
    setPopup(mode);
  }

  function confirmAddToCart() {
    if (currentVariant?.colors?.length && !color) return toast.error("Choisissez une couleur");
    if (currentVariant?.sizes?.length && !size) return toast.error("Choisissez une taille/pointure");
    addToCart({
      product_id: p.id,
      vendor_id: p.vendor_id,
      title: p.title,
      image: p.images?.[imgIdx] ?? p.images?.[0] ?? null,
      unit_price_mga: displayPrice,
      qty,
      color,
      size,
    });
    toast.success("Ajouté au panier 🛒");
    setPopup(null);
  }

  async function confirmBuy() {
    if (!user) return;
    if (currentVariant?.colors?.length && !color) return toast.error("Choisissez une couleur");
    if (currentVariant?.sizes?.length && !size) return toast.error("Choisissez une taille/pointure");
    if (!address) return toast.error("Adresse de livraison requise");
    if (!quote) return toast.error("Livraison en cours de calcul...");
    setBuying(true);
    const note = [color && `Couleur: ${color}`, size && `Taille: ${size}`].filter(Boolean).join(" | ");
    const addrText = `${address.full_name} · ${address.phone} · ${[address.street, address.quartier, address.city, address.province].filter(Boolean).join(", ")}${note ? " | " + note : ""}`;
    const { error } = await supabase.rpc("place_order" as any, {
      _product_id: id,
      _quantity: qty,
      _address: addrText,
      _address_id: address.id,
      _delivery_fee: quote.fee_mga,
      _delivery_km: quote.km,
      _delivery_days_min: quote.days_min,
      _delivery_days_max: quote.days_max,
    });
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

  async function toggleLike() {
    if (!user) return;
    if (liked) {
      await supabase.from("product_likes").delete().eq("product_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("product_likes").insert({ product_id: id, user_id: user.id });
    }
    reloadEngagement();
  }

  async function postComment() {
    if (!user || !newComment.trim()) return;
    const content = newComment.trim().slice(0, 1000);
    const { error } = await supabase.from("product_comments").insert({
      product_id: id,
      user_id: user.id,
      author_name: user.email?.split("@")[0] ?? "Utilisateur",
      content,
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    reloadEngagement();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Chargement...</div></div>;
  if (!p) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Produit introuvable.</div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white/95 backdrop-blur px-4 py-3">
        <Link to={dashboardPathForRole(role)} className="rounded-lg p-1 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-sm font-black truncate flex-1">{p.title}</h1>
        <Link to="/cart" className="rounded-lg p-1 hover:bg-muted"><ShoppingCart className="h-5 w-5" /></Link>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {/* Slider images */}
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

        {p.video_url && (
          <video src={p.video_url} controls className="w-full rounded-2xl bg-black aspect-video" />
        )}

        <div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-mada-red">{formatMGA(displayPrice)}</div>
            <div className="inline-block rounded-full bg-mada-green/10 px-2 py-0.5 text-[10px] font-bold text-mada-green">
              -2% dès 10
            </div>
          </div>
          <div className="text-sm text-muted-foreground">≈ {formatUSDT(displayPrice)}</div>
          <h2 className="mt-2 text-lg font-bold">{p.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
          <div className="mt-2 text-xs">Stock: <strong>{p.stock}</strong></div>
        </div>

        {/* Reactions row */}
        <div className="flex items-center gap-3">
          <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${liked ? "border-mada-red bg-mada-red/10 text-mada-red" : "border-border bg-white"}`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> 👍 {likes}
          </button>
          <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${liked ? "border-mada-red bg-mada-red/10 text-mada-red" : "border-border bg-white"}`}>
            ❤️ Love
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold">
            <MessageCircle className="h-4 w-4" /> {comments.length}
          </div>
        </div>

        {vendor && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Vendeur</div>
              <div className="font-bold text-sm">{vendor.shop_name}</div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
          <h3 className="text-sm font-black">💬 Commentaires</h3>
          {user && (
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Votre commentaire..."
                maxLength={1000}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button onClick={postComment} className="rounded-lg bg-mada-red px-3 text-primary-foreground"><Send className="h-4 w-4" /></button>
            </div>
          )}
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-border/50 p-2">
                  <div className="text-[10px] font-bold text-muted-foreground">{c.author_name ?? "Utilisateur"} · {new Date(c.created_at).toLocaleDateString("fr-FR")}</div>
                  <div className="text-sm">{c.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom fixed action bar */}
      {role === "client" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white px-3 py-2 shadow-2xl">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button onClick={contactSeller} className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border py-2 text-[10px] font-bold">
              <MessageCircle className="h-5 w-5 text-mada-green" />
              Message
            </button>
            <button onClick={() => openPopup("cart")} className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border py-2 text-[10px] font-bold">
              <ShoppingCart className="h-5 w-5 text-mada-red" />
              Panier
            </button>
            <button onClick={() => openPopup("buy")} disabled={p.stock === 0} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground shadow-glow-red disabled:opacity-50">
              <ShoppingBag className="h-4 w-4" /> {p.stock === 0 ? "Rupture" : "Acheter"}
            </button>
          </div>
        </div>
      )}

      {/* Variant popup */}
      {popup && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50" onClick={() => setPopup(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 space-y-4 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.images?.[imgIdx] && <img src={p.images[imgIdx]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black text-mada-red">{formatMGA(effUnit)}</div>
                {discounted && (
                  <div className="text-[10px] text-mada-green font-bold">-2% appliqué (x{qty})</div>
                )}
                <div className="text-xs text-muted-foreground">Stock: {p.stock}</div>
              </div>
              <button onClick={() => setPopup(null)} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {currentVariant?.colors?.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase mb-2">Couleur</div>
                <div className="flex flex-wrap gap-2">
                  {currentVariant.colors.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${color === c ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border"}`}>{c}</button>
                  ))}
                </div>
              </div>
            )}
            {currentVariant?.sizes?.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase mb-2">Taille / pointure</div>
                <div className="flex flex-wrap gap-2">
                  {currentVariant.sizes.map((s) => (
                    <button key={s} onClick={() => setSize(s)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${size === s ? "border-mada-green bg-mada-green text-secondary-foreground" : "border-border"}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {((currentVariant?.units && currentVariant.units.length > 0) || currentVariant?.custom) && (
              <div>
                <div className="text-xs font-bold uppercase mb-2">Unité / mesure</div>
                <div className="flex flex-wrap gap-2">
                  {currentVariant?.units?.map((u) => (
                    <span key={u} className="rounded-full border border-mada-red/40 bg-mada-red/5 px-3 py-1 text-xs font-bold text-mada-red">{u}</span>
                  ))}
                  {currentVariant?.custom && (
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs">{currentVariant.custom}</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold uppercase mb-2">Quantité</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-border"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center font-black">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(p.stock, q + 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-border"><Plus className="h-4 w-4" /></button>
                <span className="ml-2 text-xs text-muted-foreground">10+ = -2%</span>
              </div>
            </div>

            {popup === "buy" && user && (
              <div className="space-y-2">
                <AddressSelector userId={user.id} value={address?.id ?? null} onChange={setAddress} />
                <ShippingQuoteCard
                  vendorId={p.vendor_id}
                  addressId={address?.id ?? null}

                  onQuote={setQuote}
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold">Sous-total</span>
              <span className="text-sm font-black">{formatMGA(effUnit * qty)}</span>
            </div>
            {popup === "buy" && quote && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Livraison</span><span>{formatMGA(quote.fee_mga)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Total</span>
              <span className="text-xl font-black text-mada-red">{formatMGA(effUnit * qty + (popup === "buy" ? (quote?.fee_mga ?? 0) : 0))}</span>
            </div>

            {popup === "cart" ? (
              <button onClick={confirmAddToCart} className="w-full rounded-xl bg-mada-green py-3 text-sm font-black text-secondary-foreground">
                Ajouter au panier
              </button>
            ) : (
              <button onClick={confirmBuy} disabled={buying} className="w-full rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
                {buying ? "Achat..." : "Confirmer l'achat"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
