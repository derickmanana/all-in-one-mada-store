import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Edit2, Trash2, Star } from "lucide-react";
import { AddressForm, type AddressRow } from "./AddressForm";

export function AddressesPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("addresses" as any)
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, [userId]);

  async function makeDefault(id: string) {
    const { error } = await supabase.from("addresses" as any).update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Supprimer cette adresse ?")) return;
    const { error } = await supabase.from("addresses" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée");
    load();
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setAdding(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-mada-red/40 bg-mada-red/5 py-4 text-sm font-black text-mada-red">
        <Plus className="h-5 w-5" /> Ajouter une adresse
      </button>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune adresse enregistrée. Ajoutez-en une pour commander.
        </div>
      ) : rows.map((r) => (
        <div key={r.id} className={`rounded-2xl border bg-card p-4 ${r.is_default ? "border-mada-green/60 ring-2 ring-mada-green/20" : "border-border"}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black">{r.full_name}</span>
                {r.is_default && <span className="inline-flex items-center gap-0.5 rounded-full bg-mada-green/15 px-2 py-0.5 text-[10px] font-bold text-mada-green"><Star className="h-3 w-3" /> Principale</span>}
              </div>
              <div className="text-xs text-muted-foreground">{r.phone}</div>
              <div className="mt-1 text-sm flex items-start gap-1">
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-mada-red shrink-0" />
                <span>{[r.street, r.quartier, r.city, r.district, r.region, r.province].filter(Boolean).join(", ")}</span>
              </div>
              {r.details && <div className="mt-1 text-xs text-muted-foreground italic">{r.details}</div>}
              <div className="mt-1 text-[10px] text-muted-foreground">GPS: {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(r)} className="rounded-lg border border-border p-1.5 hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(r.id!)} className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {!r.is_default && (
            <button onClick={() => makeDefault(r.id!)} className="mt-2 w-full rounded-lg bg-muted py-1.5 text-xs font-bold hover:bg-muted/70">
              Définir comme principale
            </button>
          )}
        </div>
      ))}

      {(adding || editing) && (
        <AddressForm
          userId={userId}
          initial={editing ?? undefined}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
