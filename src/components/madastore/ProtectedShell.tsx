import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathForRole, type AppRole } from "@/lib/auth";
import { LogOut } from "lucide-react";

interface Props {
  expectedRole: AppRole;
  title: string;
  children: React.ReactNode;
}

export function ProtectedShell({ expectedRole, title, children }: Props) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: expectedRole === "client" ? "/auth/client" : "/auth/vendeur" });
      return;
    }
    if (role && role !== expectedRole) {
      navigate({ to: dashboardPathForRole(role) });
    }
  }, [user, role, loading, expectedRole, navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/" });
  }

  if (loading || !user || (role && role !== expectedRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-red text-primary-foreground font-black">
              M
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-medium tracking-widest text-mada-green">ALL IN ONE</div>
              <div className="text-sm font-black">{title}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:border-mada-red hover:text-mada-red transition-colors"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
