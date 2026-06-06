import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Plus, Check } from "lucide-react";
import { AddressForm, type AddressRow } from "./AddressForm";

export function AddressSelector({
  userId, value, onChange,
}: { userId: string; value: string | null; onChange: (a: AddressRow | null) => void }) {
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("addresses" as any)
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const list = (data ?? []) as any as AddressRow[];
    setRows(list);
    if (!value && list.length) onChange(list[0]);
  }
  useEffect(() => { load(); }, [userId]);

  const sel = rows.find((r) => r.id === value);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-mada-red" /> Livrer à
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-mada-red">
          {rows.length > 1 ? (open ? "Fermer" : "Changer") : ""}
        </button>
      </div>

      {sel ? (
        <div className="mt-1 text-sm">
          <div className="font-bold">{sel.full_name} · <span className="font-normal text-muted-foreground">{sel.phone}</span></div>
          <div className="text-xs">{[sel.street, sel.quartier, sel.city, sel.province].filter(Boolean).join(", ")}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Aucune adresse. Ajoutez-en une pour commander.</p>
      )}

      {open && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {rows.map((r) => (
            <button key={r.id} onClick={() => { onChange(r); setOpen(false); }}
              className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs ${value === r.id ? "border-mada-green bg-mada-green/5" : "border-border"}`}>
              {value === r.id && <Check className="mt-0.5 h-3 w-3 text-mada-green shrink-0" />}
              <div className="flex-1">
                <div className="font-bold">{r.full_name}</div>
                <div className="text-muted-foreground">{[r.street, r.quartier, r.province].filter(Boolean).join(", ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button onClick={() => setAdding(true)} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-mada-red/40 bg-mada-red/5 py-1.5 text-xs font-bold text-mada-red">
        <Plus className="h-3 w-3" /> Nouvelle adresse
      </button>

      {adding && <AddressForm userId={userId} onClose={() => setAdding(false)} onSaved={(a) => { onChange(a); load(); }} />}
    </div>
  );
}
