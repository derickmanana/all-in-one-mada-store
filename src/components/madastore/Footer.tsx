import { Phone, Mail, MessageCircle, Facebook, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-card">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-mada" />

      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-red text-primary-foreground font-black">
                M
              </div>
              <div className="leading-tight">
                <div className="text-xs font-medium tracking-widest text-mada-green">ALL IN ONE</div>
                <div className="text-lg font-black text-foreground">MADA STORE 🇲🇬</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              La marketplace 100% Malagasy. Achetez, vendez, échangez en toute sécurité.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-mada-red">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-mada-green" />
                <a href="tel:+261387909713" className="text-foreground hover:text-mada-red transition-colors">
                  +261 38 79 097 13
                  <span className="block text-xs text-muted-foreground">+261 37 63 244 15</span>
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-mada-green" />
                <a href="mailto:madegasy205@gmail.com" className="text-foreground hover:text-mada-red transition-colors">
                  madegasy205@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-mada-green" />
                <a
                  href="https://wa.me/261383729417"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground hover:text-mada-red transition-colors"
                >
                  WhatsApp : +261 38 37 294 17
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-mada-red">Suivez-nous</h3>
            <div className="mt-4 flex gap-3">
              <a
                href="https://www.facebook.com/profile.php?id=61579216474977"
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background transition-all hover:-translate-y-1 hover:border-mada-red hover:shadow-glow-red"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5 text-mada-red" />
              </a>
              <a
                href="https://wa.me/261383729417"
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background transition-all hover:-translate-y-1 hover:border-mada-green hover:shadow-glow-green"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-5 w-5 text-mada-green" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ALL IN ONE MADA STORE. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            Made with <Heart className="h-3 w-3 fill-mada-red text-mada-red" /> in Madagascar 🇲🇬
          </p>
        </div>
      </div>
    </footer>
  );
}
