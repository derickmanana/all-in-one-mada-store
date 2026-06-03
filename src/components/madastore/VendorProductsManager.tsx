import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA, formatUSDT } from "./Money";
import { Plus, Trash2, X, Heart, MessageCircle, Video as VideoIcon } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES = 10;
const MAX_IMG_MB = 15;
const MAX_VIDEO_MB = 50;

const COLOR_PRESETS = ["Noir", "Blanc", "Rouge", "Bleu", "Vert", "Jaune", "Rose", "Gris", "Marron", "Beige"];
const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_PRESETS = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

type Variant = { price_mga: number; colors: string[]; sizes: string[] };
type ImageEntry = { file: File; preview: string; variant: Variant };

type Product = {
  id: string;
  title: string;
  price_mga: number;
  stock: number;
  images: string[];
  is_active: boolean;
  category_id: string | null;
  video_url: string | null;
  variants: any;
};
type Category = { id: string; name: string };

export function VendorProductsManager({ vendorId, vendorActive }: { vendorId: string; vendorActive: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState<string>("");
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [engagement, setEngagement] = useState<Record<string, { likes: number; comments: number }>>({});

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name"),
    ]);
    const prods = (p.data ?? []) as Product[];
    setProducts(prods);
    setCats((c.data ?? []) as Category[]);
    if (c.data?.[0] && !category) setCategory(c.data[0].id);

    if (prods.length) {
      const ids = prods.map((x) => x.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("product_likes").select("product_id").in("product_id", ids),
        supabase.from("product_comments").select("product_id").in("product_id", ids),
      ]);
      const map: Record<string, { likes: number; comments: number }> = {};
      ids.forEach((id) => (map[id] = { likes: 0, comments: 0 }));
      (likes ?? []).forEach((l: any) => map[l.product_id] && map[l.product_id].likes++);
      (comments ?? []).forEach((c: any) => map[c.product_id] && map[c.product_id].comments++);
      setEngagement(map);
    }
  }
  useEffect(() => {
    load();
  }, [vendorId]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const ok: ImageEntry[] = [];
    for (const f of arr) {
      if (entries.length + ok.length >= MAX_IMAGES) {
        toast.error(`Max ${MAX_IMAGES} images`);
        break;
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: format non supporté (JPG/PNG/WEBP)`);
        continue;
      }
      if (f.size > MAX_IMG_MB * 1024 * 1024) {
        toast.error(`${f.name}: > ${MAX_IMG_MB} Mo`);
        continue;
      }
      ok.push({ file: f, preview: URL.createObjectURL(f), variant: { price_mga: 0, colors: [], sizes: [] } });
    }
    setEntries((e) => [...e, ...ok]);
  }

  function updateVariant(i: number, patch: Partial<Variant>) {
    setEntries((e) => e.map((x, idx) => (idx === i ? { ...x, variant: { ...x.variant, ...patch } } : x)));
  }
  function toggleInList(i: number, key: "colors" | "sizes", value: string) {
    setEntries((e) =>
      e.map((x, idx) => {
        if (idx !== i) return x;
        const cur = x.variant[key];
        return { ...x, variant: { ...x.variant, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] } };
      })
    );
  }
  function removeEntry(i: number) {
    setEntries((e) => e.filter((_, idx) => idx !== i));
  }

  async function create() {
    if (!title.trim()) return toast.error("Titre requis");
    if (entries.length === 0) return toast.error("Au moins une image");
    if (entries.some((e) => !e.variant.price_mga || e.variant.price_mga <= 0))
      return toast.error("Prix obligatoire pour chaque image/variante");

    setSaving(true);
    try {
      const urls: string[] = [];
      const variants: any[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const ext = (e.file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${vendorId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`;
        const up = await supabase.storage.from("products").upload(path, e.file, { contentType: e.file.type });
        if (up.error) throw up.error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
        variants.push({ image_index: i, ...e.variant });
      }

      let video_url: string | null = null;
      if (video) {
        if (video.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`Vidéo > ${MAX_VIDEO_MB} Mo`);
        const ext = (video.name.split(".").pop() || "mp4").toLowerCase();
        const vpath = `${vendorId}/video-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("products").upload(vpath, video, { contentType: video.type });
        if (up.error) throw up.error;
        video_url = supabase.storage.from("products").getPublicUrl(vpath).data.publicUrl;
      }

      const minPrice = Math.min(...variants.map((v) => v.price_mga));

      const { error } = await supabase.from("products").insert({
        vendor_id: vendorId,
        category_id: category || null,
        title,
        description: desc || null,
        price_mga: minPrice,
        stock: Number(stock) || 0,
        images: urls,
        video_url,
        variants,
      });
      if (error) throw error;
      toast.success("Produit publié");
      setShowForm(false);
      setTitle(""); setDesc(""); setStock("1"); setEntries([]); setVideo(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    load();
  }

  async function toggle(p: Product) {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  }

  if (!vendorActive) {
    return (
      <div className="rounded-2xl border-2 border-mada-red/30 bg-mada-red/5 p-6 text-center">
        <h3 className="font-bold text-mada-red">Compte non activé</h3>
        <p className="mt-2 text-sm text-muted-foreground">Vous pourrez publier dès l'activation par l'admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-mada-red px-4 py-2 text-sm font-bold text-primary-foreground">
        {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {showForm ? "Fermer" : "Ajouter un produit"}
      </button>

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du produit" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock global" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block">
              <span className="text-xs font-bold">Images du produit (max {MAX_IMAGES}, {MAX_IMG_MB} Mo, JPG/PNG/WEBP)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => addFiles(e.target.files)} className="mt-1 block w-full text-xs" />
            </label>
            <p className="mt-1 text-[10px] text-muted-foreground">Pour chaque image : un prix obligatoire, couleurs/tailles optionnelles.</p>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3">
              {entries.map((e, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex gap-3">
                    <img src={e.preview} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold">Variante #{i + 1}</div>
                        <button onClick={() => removeEntry(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><X className="h-3 w-3" /></button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase">Prix (MGA) *</label>
                        <input
                          type="number"
                          value={e.variant.price_mga || ""}
                          onChange={(ev) => updateVariant(i, { price_mga: Number(ev.target.value) })}
                          placeholder="ex. 45000"
                          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
                        />
                        {e.variant.price_mga > 0 && (
                          <div className="mt-1 text-[10px] text-muted-foreground">≈ {formatUSDT(e.variant.price_mga)}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase mb-1">Couleurs (optionnel)</div>
                        <div className="flex flex-wrap gap-1">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleInList(i, "colors", c)}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${e.variant.colors.includes(c) ? "border-mada-red bg-mada-red text-primary-foreground" : "border-border"}`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase mb-1">Tailles / pointures (optionnel)</div>
                        <div className="flex flex-wrap gap-1">
                          {[...SIZE_PRESETS, ...SHOE_PRESETS].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleInList(i, "sizes", s)}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${e.variant.sizes.includes(s) ? "border-mada-green bg-mada-green text-secondary-foreground" : "border-border"}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="block rounded-lg border border-dashed border-border p-3">
            <span className="flex items-center gap-2 text-xs font-bold"><VideoIcon className="h-4 w-4" /> Vidéo du produit (optionnel, max {MAX_VIDEO_MB} Mo)</span>
            <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            {video && <div className="mt-1 text-[10px] text-muted-foreground">{video.name} · {(video.size / 1024 / 1024).toFixed(1)} Mo</div>}
          </label>

          <button onClick={create} disabled={saving} className="w-full rounded-xl bg-mada-green py-2.5 text-sm font-black text-secondary-foreground disabled:opacity-50">
            {saving ? "Publication..." : "Publier le produit"}
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Aucun produit.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((p) => {
            const eng = engagement[p.id] ?? { likes: 0, comments: 0 };
            return (
              <div key={p.id} className={`overflow-hidden rounded-2xl border border-border bg-card ${!p.is_active && "opacity-60"}`}>
                <div className="aspect-square bg-muted relative">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                  {p.video_url && <span className="absolute top-2 left-2 rounded-full bg-black/60 p-1 text-white"><VideoIcon className="h-3 w-3" /></span>}
                </div>
                <div className="p-3 space-y-1">
                  <div className="line-clamp-1 text-xs font-bold">{p.title}</div>
                  <div className="text-sm font-black text-mada-red">{formatMGA(p.price_mga)}</div>
                  <div className="text-[10px] text-muted-foreground">≈ {formatUSDT(p.price_mga)}</div>
                  <div className="text-[10px] text-muted-foreground">Stock: {p.stock}</div>
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {eng.likes}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {eng.comments}</span>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => toggle(p)} className="flex-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold">{p.is_active ? "Cacher" : "Activer"}</button>
                    <button onClick={() => remove(p.id)} className="rounded-lg border border-destructive p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
