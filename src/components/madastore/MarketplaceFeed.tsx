import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatMGA } from "./Money";
import { Search } from "lucide-react";

type Product = {
  id: string;
  title: string;
  price_mga: number;
  images: string[];
  category_id: string | null;
};
type Category = { id: string; name: string; icon: string | null };

export function MarketplaceFeed() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("categories").select("*").then((r) => setCats((r.data ?? []) as Category[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    let req = supabase.from("products").select("id, title, price_mga, images, category_id").eq("is_active", true).order("created_at", { ascending: false }).limit(60);
    if (cat) req = req.eq("category_id", cat);
    if (q.trim()) req = req.ilike("title", `%${q.trim()}%`);
    req.then((r) => {
      setProducts((r.data ?? []) as Product[]);
      setLoading(false);
    });
  }, [cat, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-3 text-sm outline-none focus:border-mada-red"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
        <CatChip active={cat === null} onClick={() => setCat(null)} label="Tout" icon="🌍" />
        {cats.map((c) => (
          <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} icon={c.icon ?? "📦"} />
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun produit pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              to="/product/$id"
              params={{ id: p.id }}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-glow-red hover:-translate-y-0.5"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-xs font-semibold leading-tight">{p.title}</div>
                <div className="mt-2 text-sm font-black text-mada-red">{formatMGA(p.price_mga)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CatChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border bg-card hover:border-mada-red"
      }`}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
