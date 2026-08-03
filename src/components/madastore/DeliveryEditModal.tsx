import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Pencil } from "lucide-react";

const MODES = [
  { id: "personnel", label: "🚴 Personnel" },
  { id: "cooperative", label: "🚐 Coopérative" },
  { id: "avion", label: "✈️ Avion" },
  { id: "transporteur", label: "🚚 Transporteur" },
  { id: "express", label: "⚡ Express" },
];

export type EditableOrder = {
  id: string;
  product_title: string;
  delivery_fee_mga?: number | null;
  delivery_days_min?: number | null;
  delivery_days_max?: number | null;
  depart_at?: string | null;
  depart_city?: string | null;
  courier_name?: string | null;
  coop_name?: string | null;
  shipping_mode?: string | null;
  shipping_address?: string | null;
};

function toLocalInput(v?: string | null) {
  const d = v ? new Date(v) : new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function DeliveryEditModal({
  order,
  onClose,
  onDone,
}: {
  order: EditableOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fee, setFee] = useState<number>(Number(order.delivery_fee_mga ?? 0));
  const [depart, setDepart] = useState(toLocalInput(order.depart_at));
  const [city, setCity] = useState(order.depart_city ?? "");
  const [courier, setCourier] = useState(order.courier_name ?? "");
  const [coop, setCoop] = useState(order.coop_name ?? "");
  const [mode, setMode] = useState(order.shipping_mode ?? "");
  const [dmin, setDmin] = useState(Number(order.delivery_days_min ?? 2));
  const [dmax, setDmax] = useState(Number(order.delivery_days_max ?? 5));
  const [address, setAddress] = useState(order.shipping_address ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (fee < 0) return toast.error("Frais invalides");
    if (dmin < 1 || dmax < dmin) return toast.error("Délais invalides");
    setBusy(true);
    const { error } = await supabase.rpc("vendor_update_delivery" as any, {
      _order_id: order.id,
      _fee: Math.round(fee),
      _depart_at: new Date(depart).toISOString(),
      _days_min: dmin,
      _days_max: dmax,
      _mode: mode || null,
      _courier: courier || null,
      _coop: coop || null,
      _depart_city: city || null,
      _address: address || null,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Livraison mise à jour ✅");
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-border bg-card">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h3 className="flex items-center gap-2 font-black">
            <Pencil className="h-4 w-4 text-mada-green" /> Modifier la livraison
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 p-4">
          <div className="line-clamp-2 text-xs text-muted-foreground">{order.product_title}</div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Frais de livraison (MGA)</span>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Une hausse est débitée du wallet du client, une baisse lui est recréditée.
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Date & heure de départ</span>
            <input type="datetime-local" value={depart} onChange={(e) => setDepart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-muted-foreground">Délai min (j)</span>
              <input type="number" min={1} value={dmin} onChange={(e) => setDmin(+e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] text-muted-foreground">Délai max (j)</span>
              <input type="number" min={1} value={dmax} onChange={(e) => setDmax(+e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">—</option>
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>

          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lieu / ville de départ"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Nom du livreur"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={coop} onChange={(e) => setCoop(e.target.value)} placeholder="Coopérative (optionnel)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
            placeholder="Lieu de livraison / précisions"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />

          <button onClick={save} disabled={busy}
            className="w-full rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
            {busy ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </div>
  );
}
