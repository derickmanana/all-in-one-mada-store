import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { LEGAL_DOCS, LEGAL_REVIEW_NOTICE, formatLegalDate } from "@/lib/legal";
import { listAcceptances } from "@/lib/legal-acceptance";

export function LegalPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<
    { doc_key: string; version: string; accepted_at: string }[]
  >([]);

  useEffect(() => {
    listAcceptances(userId).then(setRows);
  }, [userId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black">Informations légales</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Documents consultables à tout moment.
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d.slug}
            to="/legal/$slug"
            params={{ slug: d.slug }}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
          >
            <span className="text-lg">{d.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{d.title}</span>
              <span className="block text-[11px] text-muted-foreground">
                Version {d.version} — {formatLegalDate(d.updated)}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-bold">Historique de mes acceptations</div>
        {rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Aucune acceptation enregistrée pour ce compte.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r, i) => {
              const doc = LEGAL_DOCS.find((d) => d.key === r.doc_key);
              return (
                <li key={i} className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 flex-1 font-semibold">
                    {doc?.short ?? r.doc_key} — v{r.version}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(r.accepted_at).toLocaleString("fr-FR")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="rounded-2xl border border-border bg-muted/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
        {LEGAL_REVIEW_NOTICE}
      </p>
    </div>
  );
}
