import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AddressesPanel } from "./AddressesPanel";
import { SupportChat } from "./SupportChat";
import { TicketsPanel } from "./TicketsPanel";
import { MapPin, Sparkles, LifeBuoy, LogOut, User, ChevronRight, ArrowLeft, Moon, Sun, Monitor, Ticket } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { CouponsPanel } from "./CouponsPanel";

type View = "home" | "addresses" | "ai" | "support" | "coupons";

export function ProfilePanel({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("home");
  const { user } = useAuth();
  const { mode, setTheme } = useTheme();

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    window.location.href = "/";
  }

  if (view !== "home") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("home")}
          className="inline-flex items-center gap-1 text-sm font-bold text-mada-red hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au profil
        </button>
        {view === "addresses" && <AddressesPanel userId={userId} />}
        {view === "ai" && <SupportChat />}
        {view === "support" && <TicketsPanel userId={userId} />}
        {view === "coupons" && <CouponsPanel userId={userId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-mada-red text-primary-foreground">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="font-black truncate">{user?.email ?? "Utilisateur"}</div>
          <div className="text-xs text-muted-foreground">Compte client</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        <ProfileRow icon={<MapPin className="h-5 w-5 text-mada-red" />} label="Mes adresses" onClick={() => setView("addresses")} />
        <ProfileRow icon={<Ticket className="h-5 w-5 text-mada-green" />} label="Mes coupons" onClick={() => setView("coupons")} />
        <ProfileRow icon={<Sparkles className="h-5 w-5 text-mada-green" />} label="IA Assistant" onClick={() => setView("ai")} />
        <ProfileRow icon={<LifeBuoy className="h-5 w-5 text-mada-red" />} label="Centre d'aide / Support" onClick={() => setView("support")} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Moon className="h-5 w-5 text-mada-green" /> Apparence
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            { id: "dark", label: "Sombre", icon: <Moon className="h-4 w-4" /> },
            { id: "light", label: "Clair", icon: <Sun className="h-4 w-4" /> },
            { id: "system", label: "Système", icon: <Monitor className="h-4 w-4" /> },
          ] as const).map((o) => (
            <button
              key={o.id}
              onClick={() => setTheme(o.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                mode === o.id
                  ? "border-mada-red bg-mada-red/10 text-mada-red"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>



      <button
        onClick={logout}
        className="w-full rounded-2xl border border-destructive/30 bg-destructive/10 py-3 text-sm font-black text-destructive flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> Se déconnecter
      </button>
    </div>
  );
}

function ProfileRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors">
      {icon}
      <span className="flex-1 font-bold text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
