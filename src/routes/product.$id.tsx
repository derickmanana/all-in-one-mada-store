import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathForRole } from "@/lib/auth";
import { formatMGA, formatUSDT } from "@/components/madastore/Money";
import { ArrowLeft, MessageCircle, ShoppingBag, Heart, Send } from "lucide-react";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

type Variant = { image_index: number; price_mga: number; colors: string[]; sizes: string[] };
type Comment = { id: string; user_id: string; author_name: string | null; content: string; created_at: string };

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

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

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
  const displayPrice = currentVariant?.price_mga ?? p?.price_mga ?? 0;

  async function buy() {
    if (!user) return;
    if (!address.trim()) return toast.error("Adresse de livraison requise");
    if (currentVariant?.colors?.length && !color) return toast.error("Choisissez une couleur");
    if (currentVariant?.sizes?.length && !size) return toast.error("Choisissez une taille/pointure");
    setBuying(true);
    const fullAddr = [address, color && `Couleur: ${color}`, size && `Taille: ${size}`].filter(Boolean).join(" | ");
    const { error } = await supabase.rpc("place_order", { _product_id: id, _quantity: qty, _address: fullAddr });
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
              <button key={i} onClick={() => { setImgIdx(i); setColor(null); setSize(null); }} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? "border-mada-red" : "border-transparent"}`}>
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {p.video_url && (
          <video src={p.video_url} controls className="w-full rounded-2xl bg-black aspect-video" />
        )}

        <div>
          <div className="text-3xl font-black text-mada-red">{formatMGA(displayPrice)}</div>
          <div className="text-sm text-muted-foreground">≈ {formatUSDT(displayPrice)}</div>
          <h2 className="mt-2 text-lg font-bold">{p.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
          <div className="mt-2 text-xs">Stock: <strong>{p.stock}</strong></div>
        </div>

        {currentVariant?.colors?.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase mb-2">Couleur</div>
            <div className="flex flex-wrap gap-2">
              {currentVariant.colors.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`rounded-full border px-3 py-1 text-xs font-bold ${color === c ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border"}`}>{c}</button>
              ))}
            </div>
          </div>
        )}
        {currentVariant?.sizes?.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase mb-2">Taille / pointure</div>
            <div className="flex flex-wrap gap-2">
              {currentVariant.sizes.map((s) => (
                <button key={s} onClick={() => setSize(s)} className={`rounded-lg border px-3 py-1 text-xs font-bold ${size === s ? "border-mada-green bg-mada-green text-secondary-foreground" : "border-border"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${liked ? "border-mada-red bg-mada-red/10 text-mada-red" : "border-border"}`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes}
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold">
            <MessageCircle className="h-4 w-4" /> {comments.length}
          </div>
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
              <span className="font-black text-lg text-mada-red">{formatMGA(displayPrice * qty)}</span>
            </div>
            <button onClick={buy} disabled={buying || p.stock === 0} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <ShoppingBag className="h-4 w-4" /> {buying ? "Achat en cours..." : p.stock === 0 ? "Rupture de stock" : "Acheter avec mon wallet"}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
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
    </div>
  );
}
