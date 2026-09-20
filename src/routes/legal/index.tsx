import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { LEGAL_DOCS, LEGAL_REVIEW_NOTICE, formatLegalDate } from "@/lib/legal";

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: "Informations légales — ALL IN ONE MADA STORE" },
      {
        name: "description",
        content:
          "CGU, CGV, politique de confidentialité, livraison et retours, cookies et conditions vendeur de la marketplace ALL IN ONE MADA STORE.",
      },
      { property: "og:title", content: "Informations légales — ALL IN ONE MADA STORE" },
      {
        property: "og:description",
        content: "Tous les documents juridiques de la marketplace malgache ALL IN ONE MADA STORE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalIndex,
});

function LegalIndex() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">
          Informations légales
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Retrouvez ici l'ensemble des documents encadrant l'utilisation de la
          marketplace ALL IN ONE MADA STORE.
        </p>

        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              to="/legal/$slug"
              params={{ slug: d.slug }}
              className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50"
            >
              <span className="text-xl">{d.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{d.title}</span>
                <span className="block text-xs text-muted-foreground">
                  Version {d.version} — mise à jour le {formatLegalDate(d.updated)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <p className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
          {LEGAL_REVIEW_NOTICE}
        </p>
      </div>
    </div>
  );
}
