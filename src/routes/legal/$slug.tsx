import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { LEGAL_BY_SLUG, LEGAL_REVIEW_NOTICE, formatLegalDate } from "@/lib/legal";

export const Route = createFileRoute("/legal/$slug")({
  head: ({ params }) => {
    const doc = LEGAL_BY_SLUG[params.slug];
    if (!doc) {
      return {
        meta: [
          { title: "Document introuvable — ALL IN ONE MADA STORE" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${doc.title} — ALL IN ONE MADA STORE`;
    return {
      meta: [
        { title },
        { name: "description", content: doc.intro.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: doc.intro.slice(0, 160) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: ({ params }) => {
    if (!LEGAL_BY_SLUG[params.slug]) throw notFound();
    return null;
  },
  notFoundComponent: LegalNotFound,
  component: LegalDocPage,
});

function LegalNotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-xl font-black">Document introuvable</h1>
        <Link to="/legal" className="mt-4 inline-block text-sm font-bold text-mada-red hover:underline">
          Voir tous les documents
        </Link>
      </div>
    </div>
  );
}

function LegalDocPage() {
  const { slug } = Route.useParams();
  const doc = LEGAL_BY_SLUG[slug];
  if (!doc) return <LegalNotFound />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/legal"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Informations légales
        </Link>

        <header className="mt-6">
          <div className="text-3xl">{doc.icon}</div>
          <h1 id="top" className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">
            {doc.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-mada-red/30 bg-mada-red/10 px-3 py-1 font-bold text-mada-red">
              Version {doc.version}
            </span>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-muted-foreground">
              Publié le {formatLegalDate(doc.published)}
            </span>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-muted-foreground">
              Mise à jour : {formatLegalDate(doc.updated)}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{doc.intro}</p>
        </header>

        {/* Sommaire */}
        <nav className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Sommaire
          </div>
          <ul className="mt-3 space-y-1.5">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block break-words text-sm font-semibold text-foreground/90 transition-colors hover:text-mada-red"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="mt-6 space-y-6">
          {doc.sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-6 rounded-2xl border border-border bg-card p-5"
            >
              <h2 className="break-words text-base font-black sm:text-lg">{s.title}</h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="break-words text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <p className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
          {LEGAL_REVIEW_NOTICE}
        </p>

        <div className="mt-6 flex justify-center pb-10">
          <a
            href="#top"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold transition-colors hover:bg-muted"
          >
            <ArrowUp className="h-4 w-4" /> Haut de page
          </a>
        </div>
      </div>
    </div>
  );
}
