import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA } from "./Money";
import { Wallet, Clock, ArrowDownToLine, History } from "lucide-react";

type Tx = { id: string; type: string; amount_mga: number; description: string | null; created_at: string };
type Withdrawal = { id: string; amount_mga: number; method: string; account_number: string; status: string; admin_note: string | null; created_at: string };

const METHODS = ["MVola", "Orange Money", "Airtel Money", "Binance UID"];

export function VendorWalletPanel({ userId }: { userId: string }) {
  const [available, setAvailable] = useState(0);
  const [pending, setPending] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [ws, setWs] = useState<Withdrawal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [w, t, wl] = await Promise.all([
      supabase.from("wallets").select("balance_mga, balance_pending_mga" as any).eq("user_id", userId).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    setAvailable(Number((w.data as any)?.balance_mga ?? 0));
    setPending(Number((w.data as any)?.balance_pending_mga ?? 0));
    setTxs((t.data ?? []) as Tx[]);
    setWs((wl.data ?? []) as any);
  }
  useEffect(() => { load(); }, [userId]);

  async function submit() {
    const amt = Number(amount);
    if (!amt || amt < 1000) return toast.error("Minimum 1 000 MGA");
    if (amt > available) return toast.error("Solde insuffisant");
    if (!account.trim()) return toast.error("Numéro de compte requis");
    setSubmitting(true);
    const { error } = await supabase.rpc("request_withdrawal" as any, {
      _amount: amt, _method: method, _account: account.trim(), _holder: holder.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Demande envoyée ✅ Délai 5-30 min");
    setShowForm(false); setAmount(""); setAccount(""); setHolder("");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-90"><Clock className="h-4 w-4" /> En attente</div>
          <div className="mt-2 text-2xl font-black">{formatMGA(pending)}</div>
          <div className="text-[10px] opacity-80">Débloqué après confirmation client ou 10 jours</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-mada-green to-emerald-600 p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-90"><Wallet className="h-4 w-4" /> Disponible</div>
          <div className="mt-2 text-2xl font-black">{formatMGA(available)}</div>
          <button onClick={() => setShowForm((v) => !v)} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur hover:bg-white/30">
            <ArrowDownToLine className="h-3 w-3" /> {showForm ? "Annuler" : "Retrait"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-black">Demande de retrait</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase">Méthode</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase">Montant (MGA)</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="50000" />
            </label>
            <label className="block col-span-2">
              <span className="text-[10px] font-bold uppercase">Numéro de compte / UID</span>
              <input value={account} onChange={(e) => setAccount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="0341234567" />
            </label>
            <label className="block col-span-2">
              <span className="text-[10px] font-bold uppercase">Titulaire (optionnel)</span>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Nom complet" />
            </label>
          </div>
          <button onClick={submit} disabled={submitting} className="w-full rounded-xl bg-mada-green py-2.5 text-sm font-black text-secondary-foreground disabled:opacity-50">
            {submitting ? "Envoi..." : "👉 Demander le retrait"}
          </button>
          <p className="text-[10px] text-center text-muted-foreground">L'admin valide votre retrait (délai 5 à 30 min).</p>
        </div>
      )}

      {ws.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-black">Mes retraits</h3>
          <div className="space-y-2">
            {ws.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <div>
                  <div className="font-bold">{formatMGA(w.amount_mga)}</div>
                  <div className="text-xs text-muted-foreground">{w.method} · {w.account_number} · {new Date(w.created_at).toLocaleDateString("fr-FR")}</div>
                  {w.admin_note && <div className="text-[10px] text-muted-foreground italic">{w.admin_note}</div>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  w.status === "valide" ? "bg-mada-green/15 text-mada-green" :
                  w.status === "rejete" ? "bg-destructive/15 text-destructive" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {w.status === "valide" ? "Payé ✅" : w.status === "rejete" ? "Refusé ❌" : "En attente ⏳"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-black"><History className="h-4 w-4" /> Historique</h3>
        {txs.length === 0 ? <p className="text-sm text-muted-foreground">Aucune transaction.</p> : (
          <div className="space-y-2">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
                <div>
                  <div className="font-semibold">{t.description ?? t.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</div>
                </div>
                <div className={`font-black ${t.amount_mga >= 0 ? "text-mada-green" : "text-destructive"}`}>
                  {t.amount_mga >= 0 ? "+" : ""}{formatMGA(t.amount_mga)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
