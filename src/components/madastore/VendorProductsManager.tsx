import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA } from "./Money";
import { Plus, Trash2, X } from "lucide-react";

type Product = { id: string; title: string; price_mga: number; stock: number; images: string[]; is_active: boolean; category_id: string | null };
type Category = { id: string; name: string };

export function VendorProductsManager({ vendorId, vendorActive }: { vendorId: string; vendorActive: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name"),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setCats((c.data ?? []) as Category[]);
    if (c.data?.[0] && !category) setCategory(c.data[0].id);
  }
  useEffect(() => {
    load();
  }, [vendorId]);

  async function create() {
    const pr = Number(price);
    const st = Number(stock);
    if (!title.trim() || !pr || pr <= 0) return toast.error("Titre et prix requis");
    if (files.length === 0) return toast.error("Au moins une image");
    setSaving(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, 5)) {
        if (f.size > 5 * 1024 * 1024) throw new Error("Image > 5 Mo");
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${vendorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const up = await supabase.storage.from("products").upload(path, f);
        if (up.error) throw up.error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      const { error } = await supabase.from("products").insert({
        vendor_id: vendorId,
        category_id: category || null,
        title,
        description: desc || null,
        price_mga: pr,
        stock: st,
        images: urls,
      });
      if (error) throw error;
      toast.success("Produit publié");
      setShowForm(false);
      setTitle(""); setDesc(""); setPrice(""); setStock("1"); setFiles([]);
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
        <p className="mt-2 text-sm text-muted-foreground">Vous pourrez publier des produits dès que l'admin aura validé votre boutique.</p>
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
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du produit" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix MGA" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="block">
            <span className="text-xs font-bold">Images (max 5)</span>
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="mt-1 block w-full text-xs" />
          </label>
          <button onClick={create} disabled={saving} className="w-full rounded-xl bg-mada-green py-2 text-sm font-black text-secondary-foreground disabled:opacity-50">
            {saving ? "Publication..." : "Publier"}
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Aucun produit. Ajoutez votre premier produit ci-dessus.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className={`overflow-hidden rounded-2xl border border-border bg-card ${!p.is_active && "opacity-60"}`}>
              <div className="aspect-square bg-muted">
                {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="p-3 space-y-1">
                <div className="line-clamp-1 text-xs font-bold">{p.title}</div>
                <div className="text-sm font-black text-mada-red">{formatMGA(p.price_mga)}</div>
                <div className="text-[10px] text-muted-foreground">Stock: {p.stock}</div>
                <div className="flex gap-1 pt-1">
                  <button onClick={() => toggle(p)} className="flex-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold">{p.is_active ? "Cacher" : "Activer"}</button>
                  <button onClick={() => remove(p.id)} className="rounded-lg border border-destructive p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
