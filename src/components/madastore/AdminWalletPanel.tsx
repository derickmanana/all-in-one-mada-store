import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA } from "./Money";
import { Coins, Banknote, ArrowLeftRight, Send, History, ArrowDownToLine } from "lucide-react";

type Tx = { id: string; type: string; amount_mga: number; description: string | null; created_at: string };
type Withdrawal = { id: string; user_id: string; amount_mga: number; method: string; account_number: string; account_holder: string | null; status: string; admin_note: string | null; created_at: string };

export function AdminWalletPanel({ userId }: { userId: string }) {
  const [commission, setCommission] = useState(0);
  const [funds, setFunds] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [ws, setWs] = useState<Withdrawal[]>([]);
  const [transferAmt, setTransferAmt] = useState("");
  const [direction, setDirection] = useState<"comm_to_funds" | "funds_to_comm">("comm_to_funds");
  const [clientId, setClientId] = useState("");
  const [clientAmt, setClientAmt] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  async function load() {
    const [w, t, wl] = await Promise.all([
      supabase.from("wallets").select("balance_commission_mga, balance_admin_funds_mga" as any).eq("user_id", userId).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setCommission(Number((w.data as any)?.balance_commission_mga ?? 0));
    setFunds(Number((w.data as any)?.balance_admin_funds_mga ?? 0));
    setTxs((t.data ?? []) as Tx[]);
    setWs((wl.data ?? []) as any);
  }
  useEffect(() => { load(); }, [userId]);

  async function doTransfer() {
    const amt = Number(transferAmt);
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    const { error } = await supabase.rpc("admin_transfer_funds" as any, { _direction: direction, _amount: amt });
    if (error) return toast.error(error.message);
    toast.success("Transfert effectué ✅");
    setTransferAmt(""); load();
  }

  async function sendToClient() {
    const amt = Number(clientAmt);
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    if (!clientId.trim()) return toast.error("ID client requis");
    const { error } = await supabase.rpc("admin_send_to_client" as any, { _client_id: clientId.trim(), _amount: amt, _note: clientNote || null });
    if (error) return toast.error(error.message);
    toast.success("Envoyé au client ✅");
    setClientId(""); setClientAmt(""); setClientNote(""); load();
  }

  async function reviewWithdrawal(id: string, approve: boolean) {
    const { error } = await supabase.rpc("admin_validate_withdrawal" as any, { _id: id, _approve: approve, _note: note[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Retrait validé ✅" : "Retrait rejeté ❌");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-mada-green p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-90"><Coins className="h-4 w-4" /> Commissions</div>
          <div className="mt-2 text-2xl font-black">{formatMGA(commission)}</div>
          <div className="text-[10px] opacity-80">Solde retirable</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-mada-red to-pink-600 p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-90"><Banknote className="h-4 w-4" /> Fonds Admin</div>
          <div className="mt-2 text-2xl font-black">{formatMGA(funds)}</div>
          <div className="text-[10px] opacity-80">Remboursements, bonus, litiges</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="flex items-center gap-2 font-black"><ArrowLeftRight className="h-4 w-4" /> Transfert interne</h3>
        <div className="grid grid-cols-2 gap-3">
          <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="comm_to_funds">Commissions → Fonds</option>
            <option value="funds_to_comm">Fonds → Commissions</option>
          </select>
          <input type="number" value={transferAmt} onChange={(e) => setTransferAmt(e.target.value)} placeholder="Montant MGA" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={doTransfer} className="w-full rounded-xl bg-foreground py-2.5 text-sm font-black text-background">Transférer</button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="flex items-center gap-2 font-black"><Send className="h-4 w-4" /> Envoyer à un client (fonds admin)</h3>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ID utilisateur client" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={clientAmt} onChange={(e) => setClientAmt(e.target.value)} placeholder="Montant MGA" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={clientNote} onChange={(e) => setClientNote(e.target.value)} placeholder="Motif (remboursement, bonus...)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={sendToClient} className="w-full rounded-xl bg-mada-red py-2.5 text-sm font-black text-primary-foreground">Envoyer</button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-black"><ArrowDownToLine className="h-4 w-4" /> Retraits vendeurs</h3>
        {ws.length === 0 ? <p className="text-sm text-muted-foreground">Aucun retrait.</p> : (
          <div className="space-y-2">
            {ws.map((w) => (
              <div key={w.id} className="rounded-lg border border-border/60 p-3 text-sm space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-mada-red">{formatMGA(w.amount_mga)}</div>
                    <div className="text-xs text-muted-foreground">{w.method} · {w.account_number} {w.account_holder ? `· ${w.account_holder}` : ""}</div>
                    <div className="text-[10px] text-muted-foreground">Vendeur: <span className="font-mono">{w.user_id.slice(0, 8)}</span> · {new Date(w.created_at).toLocaleString("fr-FR")}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    w.status === "valide" ? "bg-mada-green/15 text-mada-green" :
                    w.status === "rejete" ? "bg-destructive/15 text-destructive" : "bg-yellow-100 text-yellow-800"
                  }`}>{w.status}</span>
                </div>
                {w.status === "en_attente" && (
                  <>
                    <input value={note[w.id] ?? ""} onChange={(e) => setNote({ ...note, [w.id]: e.target.value })} placeholder="Note (référence transfert...)" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
                    <div className="flex gap-2">
                      <button onClick={() => reviewWithdrawal(w.id, true)} className="flex-1 rounded-lg bg-mada-green py-1.5 text-xs font-black text-secondary-foreground">Valider et payer</button>
                      <button onClick={() => reviewWithdrawal(w.id, false)} className="flex-1 rounded-lg border border-destructive py-1.5 text-xs font-black text-destructive">Rejeter</button>
                    </div>
                  </>
                )}
                {w.admin_note && w.status !== "en_attente" && <div className="rounded bg-muted p-1.5 text-[10px]">Note: {w.admin_note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-black"><History className="h-4 w-4" /> Historique admin</h3>
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
