import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Truck, MapPin, CheckCircle2 } from "lucide-react";

const MODES = [
  { id: "personnel", label: "🚴 Personnel", dmin: 1, dmax: 2 },
  { id: "cooperative", label: "🚐 Coopérative", dmin: 2, dmax: 5 },
  { id: "avion", label: "✈️ Avion", dmin: 1, dmax: 2 },
  { id: "transporteur", label: "🚚 Transporteur indépendant", dmin: 3, dmax: 7 },
  { id: "express", label: "⚡ Express", dmin: 1, dmax: 2 },
];

type Order = {
  id: string;
  product_title: string;
  shipping_address?: string | null;
};

export function ShippingModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<string>("");
  const [courier, setCourier] = useState("");
  const [coop, setCoop] = useState("");
  const [city, setCity] = useState("");
  const [depart, setDepart] = useState(() => new Date().toISOString().slice(0, 16));
  const [dmin, setDmin] = useState(2);
  const [dmax, setDmax] = useState(5);
  const [dest, setDest] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function pickMode(m: typeof MODES[number]) {
    setMode(m.id); setDmin(m.dmin); setDmax(m.dmax); setStep(2);
  }

  async function submitShip() {
    if (!mode || !courier.trim() || !city.trim()) return toast.error("Complétez les champs");
    setBusy(true);
    const { error } = await supabase.rpc("vendor_ship_order" as any, {
      _order_id: order.id, _mode: mode, _courier: courier, _coop: coop || null,
      _depart_city: city, _depart_at: new Date(depart).toISOString(),
      _days_min: dmin, _days_max: dmax,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Load destination address from order
    const { data } = await supabase.from("orders").select("shipping_address, address_id, addresses(*)" as any).eq("id", order.id).maybeSingle();
    setDest(data);
    setStep(3);
  }

  async function confirmDest() {
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-card border border-border">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h3 className="font-black flex items-center gap-2"><Truck className="h-5 w-5 text-mada-green" /> Expédier · Étape {step}/3</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">Mode de livraison</p>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => pickMode(m)}
                  className="w-full text-left rounded-xl border border-border bg-background p-3 hover:border-mada-green">
                  <div className="font-bold text-sm">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">Délai estimé {m.dmin} à {m.dmax} jours</div>
                </button>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg bg-muted p-2 text-xs">Mode: <b>{MODES.find(x=>x.id===mode)?.label}</b></div>
              <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Nom du livreur *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input value={coop} onChange={(e) => setCoop(e.target.value)} placeholder="Nom coopérative (optionnel)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville de départ *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <label className="text-xs font-bold">Date & heure départ</label>
              <input type="datetime-local" value={depart} onChange={(e) => setDepart(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Délai min (j)</label><input type="number" min={1} value={dmin} onChange={(e) => setDmin(+e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
                <div><label className="text-xs">Délai max (j)</label><input type="number" min={1} value={dmax} onChange={(e) => setDmax(+e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
              </div>
              <button onClick={submitShip} disabled={busy} className="w-full rounded-xl bg-mada-green py-3 text-sm font-black text-secondary-foreground disabled:opacity-50">
                {busy ? "..." : "Ajouter"}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-mada-green"><CheckCircle2 className="h-5 w-5" /><span className="font-black">Livreur enregistré</span></div>
              <div className="rounded-xl border border-border p-3">
                <div className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Destination</div>
                {dest?.addresses ? (
                  <div className="mt-1 text-sm">
                    <div className="font-bold">{dest.addresses.full_name} · {dest.addresses.phone}</div>
                    <div>{[dest.addresses.street, dest.addresses.quartier, dest.addresses.city, dest.addresses.district, dest.addresses.region, dest.addresses.province].filter(Boolean).join(", ")}</div>
                    {dest.addresses.details && <div className="text-xs italic text-muted-foreground">{dest.addresses.details}</div>}
                  </div>
                ) : (
                  <div className="mt-1 text-sm">{dest?.shipping_address || "Adresse non renseignée"}</div>
                )}
              </div>
              <button onClick={confirmDest} className="w-full rounded-xl bg-mada-red py-3 text-sm font-black text-primary-foreground">
                Enregistrer adresse
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
