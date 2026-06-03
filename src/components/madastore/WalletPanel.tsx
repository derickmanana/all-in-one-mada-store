import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMGA, formatUSDT, MGA_PER_USDT } from "./Money";
import { Wallet, Upload, History, Copy, Check } from "lucide-react";

type Tx = { id: string; type: string; amount_mga: number; description: string | null; created_at: string };
type Deposit = { id: string; amount_mga: number; method: string; status: string; created_at: string };

const PAYMENT_METHODS = [
  { key: "MVola", label: "MVola", number: "0387909713", holder: "Jean Noel", color: "bg-yellow-100 text-yellow-900" },
  { key: "Orange Money", label: "Orange Money", number: "0376324415", holder: "Jean Noel", color: "bg-orange-100 text-orange-900" },
  { key: "Airtel Money", label: "Airtel Money", number: "0339781423", holder: "Jean Noel", color: "bg-red-100 text-red-900" },
  { key: "Binance", label: "Binance UID", number: "1028468482", holder: "USDT (BEP20/TRC20)", color: "bg-amber-100 text-amber-900" },
] as const;

const MAX_PROOF_MB = 15;

export function WalletPanel({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0].key);
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const [w, t, d] = await Promise.all([
      supabase.from("wallets").select("balance_mga").eq("user_id", userId).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    setBalance(Number(w.data?.balance_mga ?? 0));
    setTxs((t.data ?? []) as Tx[]);
    setDeposits((d.data ?? []) as Deposit[]);
  }

  useEffect(() => {
    load();
  }, [userId]);

  function copyNum(n: string) {
    navigator.clipboard.writeText(n).then(() => {
      setCopied(n);
      toast.success("Copié");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function submitDeposit() {
    const amt = Number(amount);
    if (!amt || amt < 1000) return toast.error("Montant minimum: 1 000 MGA");
    if (!file) return toast.error("Capture de paiement obligatoire");
    if (file.size > MAX_PROOF_MB * 1024 * 1024) return toast.error(`Image max ${MAX_PROOF_MB} Mo`);
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("proofs").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.from("deposits").insert({
        user_id: userId,
        amount_mga: amt,
        method,
        proof_url: path,
        reference: reference || null,
      });
      if (error) throw error;
      toast.success("Dépôt envoyé. En attente de validation admin.");
      setShowForm(false);
      setAmount("");
      setReference("");
      setFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedMethod = PAYMENT_METHODS.find((m) => m.key === method)!;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-red p-6 text-primary-foreground shadow-glow-red">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-90">
          <Wallet className="h-4 w-4" /> Solde Wallet
        </div>
        <div className="mt-2 text-4xl font-black">{formatMGA(balance)}</div>
        <div className="text-sm opacity-80">≈ {formatUSDT(balance)} <span className="opacity-60">(1 USDT = {MGA_PER_USDT} MGA)</span></div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/25"
        >
          <Upload className="h-4 w-4" /> {showForm ? "Annuler" : "Dépôt"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-black">Nouveau dépôt</h3>

          <div>
            <div className="text-xs font-bold mb-2">1. Choisissez une méthode</div>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`rounded-xl border-2 p-2 text-left text-xs ${method === m.key ? "border-mada-red bg-mada-red/5" : "border-border"}`}
                >
                  <div className="font-black">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.holder}</div>
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-xl p-3 ${selectedMethod.color}`}>
            <div className="text-[10px] font-bold uppercase opacity-80">Envoyez le paiement à</div>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <div className="text-xl font-black tracking-wider">{selectedMethod.number}</div>
                <div className="text-[10px] opacity-80">{selectedMethod.holder}</div>
              </div>
              <button onClick={() => copyNum(selectedMethod.number)} className="rounded-lg bg-white/40 p-2 hover:bg-white/60">
                {copied === selectedMethod.number ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold mb-2">2. Détails du paiement</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase">Montant (MGA)</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="50000"
                />
                {Number(amount) > 0 && <div className="mt-1 text-[10px] text-muted-foreground">≈ {formatUSDT(Number(amount))}</div>}
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase">Référence (optionnel)</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="ID transaction"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold mb-2">3. Capture de paiement (obligatoire)</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs"
            />
          </div>

          <button
            onClick={submitDeposit}
            disabled={submitting}
            className="w-full rounded-xl bg-mada-green py-2.5 text-sm font-black text-secondary-foreground disabled:opacity-50"
          >
            {submitting ? "Envoi..." : "👉 Valider paiement"}
          </button>
          <p className="text-[10px] text-center text-muted-foreground">L'admin validera votre dépôt et le solde sera crédité automatiquement.</p>
        </div>
      )}

      {deposits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-black">Mes dépôts</h3>
          <div className="space-y-2">
            {deposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <div>
                  <div className="font-bold">{formatMGA(d.amount_mga)}</div>
                  <div className="text-xs text-muted-foreground">{d.method} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    d.status === "valide"
                      ? "bg-mada-green/15 text-mada-green"
                      : d.status === "rejete"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {d.status === "valide" ? "Accepté ✅" : d.status === "rejete" ? "Refusé ❌" : "En attente ⏳"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-black"><History className="h-4 w-4" /> Historique</h3>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune transaction.</p>
        ) : (
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
