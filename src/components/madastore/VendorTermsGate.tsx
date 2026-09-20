import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, Store } from "lucide-react";
import { LEGAL_BY_SLUG, formatLegalDate } from "@/lib/legal";
import { hasAccepted, recordAcceptances } from "@/lib/legal-acceptance";

const POINTS = [
  "Publication des produits et exactitude des informations",
  "Prix, stock, photos, descriptions et promotions",
  "Traitement des commandes, préparation des colis et livraison",
  "Service après-vente, retours et remboursements",
  "Produits interdits et sanctions en cas de fraude",
  "Commissions marketplace, portefeuille vendeur et retraits",
];

export function VendorTermsGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<"loading" | "needed" | "ok">("loading");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const doc = LEGAL_BY_SLUG["vendeur"]!;

  useEffect(() => {
    hasAccepted(userId, "vendeur").then((ok) => setState(ok ? "ok" : "needed"));
  }, [userId]);

  async function accept() {
    setSaving(true);
    await recordAcceptances(userId, ["vendeur"]);
    const ok = await hasAccepted(userId, "vendeur");
    setSaving(false);
    if (!ok) return toast.error("Enregistrement impossible, réessayez.");
    toast.success("Conditions vendeur acceptées");
    setState("ok");
  }

  if (state === "loading") {
    return <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (state === "ok") return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mada-green/10 text-mada-green">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black">Conditions Vendeur / Marketplace</h2>
          <p className="text-[11px] text-muted-foreground">
            Version {doc.version} — {formatLegalDate(doc.updated)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Avant de vendre sur ALL IN ONE MADA STORE, vous devez accepter les règles
        marketplace portant notamment sur :
      </p>
      <ul className="mt-3 space-y-1.5">
        {POINTS.map((p) => (
          <li key={p} className="flex gap-2 text-sm">
            <span className="text-mada-green">•</span>
            <span className="min-w-0 flex-1">{p}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/legal/$slug"
        params={{ slug: "vendeur" }}
        target="_blank"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-mada-green underline underline-offset-2"
      >
        Lire les Conditions Vendeur <ExternalLink className="h-3.5 w-3.5" />
      </Link>

      <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-mada-green)]"
        />
        <span className="min-w-0 flex-1 leading-snug">
          J'ai lu et j'accepte les Conditions Vendeur / Marketplace.
        </span>
      </label>

      <button
        onClick={accept}
        disabled={!checked || saving}
        className="mt-4 w-full rounded-xl bg-mada-green px-6 py-3 text-sm font-black text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Enregistrement…" : "Accepter et continuer"}
      </button>
    </div>
  );
}
