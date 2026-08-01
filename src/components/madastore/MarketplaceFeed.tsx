import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMGA } from "./Money";
import { Search, ShoppingCart, Camera, X, Loader2, Flame, Ticket, Zap, Sparkles, TrendingUp, BadgePercent, Leaf } from "lucide-react";
import { analyzeProductImage } from "@/lib/image-search.functions";
import { toast } from "sonner";

type Product = {
  id: string;
  title: string;
  price_mga: number;
  images: string[];
  category_id: string | null;
  discount_percent: number;
  promo_until: string | null;
  sold_count: number;
  view_count: number;
  click_count: number;
  final_price_mga: number;
};
type Category = { id: string; name: string; icon: string | null };
type Coupon = { id: string; code: string; percent: number; expires_at: string };

const PAGE_SIZE = 24;

const TABS = [
  { id: "pour_toi", label: "Pour toi", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "promos", label: "Promos", icon: <BadgePercent className="h-3.5 w-3.5" /> },
  { id: "coupons", label: "Coupons", icon: <Ticket className="h-3.5 w-3.5" /> },
  { id: "flash", label: "Flash", icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "tendance", label: "Tendance", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: "nouveautes", label: "Nouveautés", icon: <Flame className="h-3.5 w-3.5" /> },
  { id: "bon_marche", label: "Bon marché", icon: <Leaf className="h-3.5 w-3.5" /> },
];

const PRICES: { label: string; min: number | null; max: number | null }[] = [
  { label: "Tous prix", min: null, max: null },
  { label: "< 5 000", min: null, max: 5000 },
  { label: "5k – 20k", min: 5000, max: 20000 },
  { label: "20k – 50k", min: 20000, max: 50000 },
  { label: "50k – 200k", min: 50000, max: 200000 },
  { label: "200k – 1M", min: 200000, max: 1000000 },
  { label: "> 1M", min: 1000000, max: null },
];

export function MarketplaceFeed() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [tab, setTab] = useState("pour_toi");
  const [priceIdx, setPriceIdx] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgBadge, setImgBadge] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const analyze = useServerFn(analyzeProductImage);

  useEffect(() => {
    supabase.from("categories").select("*").then((r) => setCats((r.data ?? []) as Category[]));
    refreshCart();
    const handler = () => refreshCart();
    window.addEventListener("dago-cart-changed", handler);
    // Coupons IA : générés selon l'activité du client
    supabase.rpc("grant_loyalty_coupons" as any).then(() => loadCoupons());
    return () => window.removeEventListener("dago-cart-changed", handler);
  }, []);

  function loadCoupons() {
    supabase
      .from("coupons" as any)
      .select("id, code, percent, expires_at")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("percent", { ascending: false })
      .then((r) => setCoupons(((r.data ?? []) as any[]) as Coupon[]));
  }

  function refreshCart() {
    try {
      const raw = localStorage.getItem("dago_cart");
      const arr = raw ? JSON.parse(raw) : [];
      setCartCount(arr.reduce((s: number, i: any) => s + (i.qty ?? 0), 0));
    } catch {
      setCartCount(0);
    }
  }

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      const range = PRICES[priceIdx];
      const { data, error } = await supabase.rpc("feed_products" as any, {
        _tab: tab,
        _category: cat,
        _q: q.trim() || null,
        _min_price: range.min,
        _max_price: range.max,
        _limit: PAGE_SIZE,
        _offset: offset,
      } as any);
      if (error) {
        setHasMore(false);
        return;
      }
      const list = ((data ?? []) as any[]) as Product[];
      setHasMore(list.length === PAGE_SIZE);
      setProducts((prev) => (replace ? list : [...prev, ...list]));
    },
    [cat, q, tab, priceIdx],
  );

  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

  // Enregistre la recherche pour l'IA de recommandation
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      supabase.rpc("track_event" as any, { _event_type: "search", _query: q.trim() } as any).then(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!sentinelRef.current || loading || !hasMore) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          fetchPage(products.length, false).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [products.length, hasMore, loadingMore, loading, fetchPage]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 6_000_000) return toast.error("Image trop grande (max 6 Mo)");
    setImgSearching(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const out = await analyze({ data: { imageBase64: b64, mimeType: f.type || "image/jpeg" } });
      if (out.error || !out.keywords) {
        toast.error(out.error || "Aucun mot-clé détecté");
      } else {
        setQ(out.keywords);
        setImgBadge(out.keywords);
        toast.success("Recherche visuelle : " + out.keywords);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setImgSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Recherche */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-full border-2 border-mada-red/20 bg-white pl-10 pr-10 py-2.5 text-sm outline-none focus:border-mada-red"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imgSearching}
            title="Recherche par image"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-mada-green text-secondary-foreground disabled:opacity-50"
          >
            {imgSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
        <Link
          to="/cart"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-mada-red text-primary-foreground shadow-glow-red"
        >
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-mada-green px-1 text-[10px] font-black text-secondary-foreground">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      {imgBadge && (
        <div className="flex items-center gap-2 rounded-full bg-mada-green/10 px-3 py-1.5 text-xs">
          <Camera className="h-3 w-3 text-mada-green" />
          <span className="font-bold">Recherche visuelle:</span>
          <span className="truncate">{imgBadge}</span>
          <button onClick={() => { setImgBadge(null); setQ(""); }} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Bandeau coupons IA */}
      {coupons.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-gradient-to-r from-mada-red to-mada-red/70 px-3 py-2 text-primary-foreground scrollbar-hide">
          <Ticket className="h-4 w-4 shrink-0" />
          <span className="shrink-0 text-xs font-black uppercase">Vos coupons</span>
          {coupons.map((c) => (
            <span key={c.id} className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
              -{c.percent}% · {c.code}
            </span>
          ))}
          <span className="shrink-0 text-[10px] opacity-80">appliqué automatiquement au paiement</span>
        </div>
      )}

      {/* Barre 1 : rubriques IA */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === t.id
                ? "border-mada-red bg-mada-red text-primary-foreground shadow-glow-red"
                : "border-border bg-white hover:border-mada-red"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Barre 2 : tranches de prix */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
        {PRICES.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPriceIdx(i)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
              priceIdx === i
                ? "border-mada-green bg-mada-green text-secondary-foreground"
                : "border-border bg-white hover:border-mada-green"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Barre catégories */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
        <CatChip active={cat === null} onClick={() => setCat(null)} label="Tout" icon="🌍" />
        {cats.map((c) => (
          <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} icon={c.icon ?? "📦"} />
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun produit dans cette rubrique.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-12 flex items-center justify-center text-xs text-muted-foreground">
            {loadingMore ? "Chargement..." : hasMore ? "" : "— Fin —"}
          </div>
        </>
      )}
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  const promo = p.discount_percent > 0 && (!p.promo_until || new Date(p.promo_until) > new Date());
  const flash = promo && p.discount_percent >= 20 && !!p.promo_until;
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      onClick={() => {
        supabase.rpc("increment_product_click" as any, { _product_id: p.id } as any).then(() => {});
        supabase.rpc("track_event" as any, { _event_type: "click", _product_id: p.id } as any).then(() => {});
      }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-white transition-all hover:border-mada-red hover:shadow-lg active:scale-[0.98]"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {p.images?.[0] ? (
          <img
            src={p.images[0]}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">📦</div>
        )}
        {flash && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-mada-red px-2 py-0.5 text-[10px] font-black text-primary-foreground shadow">
            ⚡ FLASH -{p.discount_percent}%
          </span>
        )}
        {promo && !flash && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-mada-green px-2 py-0.5 text-[10px] font-black text-secondary-foreground shadow">
            -{p.discount_percent}%
          </span>
        )}
        {p.sold_count > 0 && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
            {p.sold_count} vendus
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground/90 min-h-[28px]">
          {p.title}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-black text-mada-red">{formatMGA(p.final_price_mga ?? p.price_mga)}</span>
          {promo && (
            <span className="text-[10px] text-muted-foreground line-through">{formatMGA(p.price_mga)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CatChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
        active ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border bg-white hover:border-mada-red"
      }`}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
