import { Phone, Mail, MessageCircle, Facebook, Heart, ArrowUpRight } from "lucide-react";

const CONTACTS = [
  {
    icon: Phone,
    label: "Téléphone",
    value: "037 63 244 15",
    hint: "Appelez-nous directement",
    href: "tel:+261376324415",
    external: false,
    accent: "mada-red",
  },
  {
    icon: Mail,
    label: "Email",
    value: "all.in.one.mada.store@gmail.com",
    hint: "Écrivez-nous à tout moment",
    href: "mailto:all.in.one.mada.store@gmail.com",
    external: false,
    accent: "mada-green",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+86 130 2511 0873",
    hint: "Réponse rapide sur WhatsApp",
    href: "https://wa.me/8613025110873",
    external: true,
    accent: "mada-green",
  },
] as const;

const SOCIALS = [
  {
    icon: Facebook,
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61579216474977",
    accent: "mada-red",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    href: "https://wa.me/8613025110873",
    accent: "mada-green",
  },
] as const;

export function Footer() {
  return (
    <footer className="relative bg-footer text-footer-foreground">
      <div className="h-1 bg-gradient-mada" />

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-16">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-red text-lg font-black text-primary-foreground shadow-glow-red">
              M
            </div>
            <div className="text-left leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mada-green">
                ALL IN ONE
              </div>
              <div className="text-xl font-black tracking-tight sm:text-2xl">
                MADA STORE 🇲🇬
              </div>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-footer-muted sm:text-base">
            La marketplace 100% Malagasy. Achetez, vendez et développez votre
            activité en toute simplicité.
          </p>
        </div>

        {/* Contact cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.label}
                href={c.href}
                target={c.external ? "_blank" : undefined}
                rel={c.external ? "noreferrer" : undefined}
                className="group relative flex min-w-0 items-center gap-4 rounded-2xl border border-footer-border bg-footer-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-footer-border-hover hover:bg-footer-card-hover hover:shadow-glow-green sm:p-5"
                aria-label={`${c.label} : ${c.value}`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110 ${
                    c.accent === "mada-red"
                      ? "border-mada-red/30 bg-mada-red/10"
                      : "border-mada-green/30 bg-mada-green/10"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      c.accent === "mada-red" ? "text-mada-red" : "text-mada-green"
                    }`}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-footer-muted">
                    {c.label}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold sm:text-[15px]">
                    {c.value}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-footer-muted">
                    {c.hint}
                  </span>
                </span>

                <ArrowUpRight className="h-4 w-4 shrink-0 text-footer-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mada-green" />
              </a>
            );
          })}
        </div>

        {/* Social */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-footer-muted">
            Suivez-nous
          </h3>
          <div className="flex gap-4">
            {SOCIALS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border border-footer-border bg-footer-card transition-all duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95 ${
                    s.accent === "mada-red"
                      ? "hover:border-mada-red hover:shadow-glow-red"
                      : "hover:border-mada-green hover:shadow-glow-green"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      s.accent === "mada-red" ? "text-mada-red" : "text-mada-green"
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-footer-border pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-footer-muted">
            © {new Date().getFullYear()} ALL IN ONE MADA STORE. Tous droits réservés.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-footer-muted">
            Made with{" "}
            <Heart className="h-3 w-3 fill-mada-red text-mada-red" /> in
            Madagascar 🇲🇬
          </p>
        </div>
      </div>
    </footer>
  );
}
