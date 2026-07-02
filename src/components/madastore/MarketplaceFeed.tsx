import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatMGA } from "./Money";
import { Search, ShoppingCart } from "lucide-react";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (cat) req = req.eq("category_id", cat);
      if (q.trim()) req = req.ilike("title", `%${q.trim()}%`);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-full border-2 border-mada-red/20 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-mada-red"
          />
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

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
        <CatChip active={cat === null} onClick={() => setCat(null)} label="Tout" icon="🌍" />
        {cats.map((c) => (
          <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} icon={c.icon ?? "📦"} />
        ))}
      </div>

      {!q.trim() && (
        <div className="rounded-2xl border-2 border-mada-red/10 bg-gradient-to-br from-white to-mada-red/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">🇲🇬 Catégories</h3>
            {cat && (
              <button
                onClick={() => setCat(null)}
                className="text-[11px] font-bold text-mada-red hover:underline"
              >
                Voir tout
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11">
            <CatTile active={cat === null} onClick={() => setCat(null)} label="Tout" icon="🌍" />
            {cats.map((c) => (
              <CatTile
                key={c.id}
                active={cat === c.id}
                onClick={() => setCat(c.id)}
                label={c.name}
                icon={c.icon ?? "📦"}
              />
            ))}
          </div>
        </div>
      )}

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
