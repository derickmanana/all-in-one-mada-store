import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMGA } from "./Money";
import { Search, ShoppingCart, Camera, X, Loader2 } from "lucide-react";
import { analyzeProductImage } from "@/lib/image-search.functions";
import { toast } from "sonner";

type Product = {
  id: string;
  title: string;
  price_mga: number;
  images: string[];
  category_id: string | null;
};
type Category = { id: string; name: string; icon: string | null };

const PAGE_SIZE = 24;

export function MarketplaceFeed() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgBadge, setImgBadge] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const analyze = useServerFn(analyzeProductImage);

  useEffect(() => {
    supabase.from("categories").select("*").then((r) => setCats((r.data ?? []) as Category[]));
    refreshCart();
    const handler = () => refreshCart();
    window.addEventListener("dago-cart-changed", handler);
    return () => window.removeEventListener("dago-cart-changed", handler);
  }, []);

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
    async (from: number, replace: boolean) => {
      let req = supabase
        .from("products")
        .select("id, title, price_mga, images, category_id")
        .eq("is_active", true)
        .order("click_count", { ascending: false })
        .order("view_count", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (cat) req = req.eq("category_id", cat);
      if (q.trim()) {
        const tokens = q.trim().split(/\s+/).slice(0, 6);
        const or = tokens.map((t) => `title.ilike.%${t}%,description.ilike.%${t}%`).join(",");
        req = req.or(or);
      }
      const { data } = await req;
      const list = (data ?? []) as Product[];
      setHasMore(list.length === PAGE_SIZE);
      setProducts((prev) => (replace ? list : [...prev, ...list]));
    },
    [cat, q],
  );

  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

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
          Aucun produit pour le moment.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="group overflow-hidden rounded-xl border border-border bg-white transition-all hover:border-mada-red hover:shadow-md active:scale-[0.98]"
              >
                <div className="aspect-square overflow-hidden bg-muted">
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
                </div>
                <div className="p-2">
                  <div className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground/90 min-h-[28px]">
                    {p.title}
                  </div>
                  <div className="mt-1 text-sm font-black text-mada-red">{formatMGA(p.price_mga)}</div>
                </div>
              </Link>
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

function CatTile({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95 ${
        active
          ? "border-mada-red bg-mada-red text-primary-foreground shadow-glow-red"
          : "border-border bg-white hover:border-mada-red/50"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="line-clamp-1 text-[10px] font-bold leading-tight">{label}</span>
    </button>
  );
}
