import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vendeur" | "client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // Defer DB call to avoid deadlock inside the listener
        setTimeout(() => fetchRole(s.user.id).then((r) => mounted && setRole(r)), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchRole(data.session.user.id).then((r) => {
          if (!mounted) return;
          setRole(r);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, role, loading };
}

async function fetchRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("role", { ascending: true });
  if (!data || data.length === 0) return null;
  // priority: admin > vendeur > client
  if (data.some((r) => r.role === "admin")) return "admin";
  if (data.some((r) => r.role === "vendeur")) return "vendeur";
  if (data.some((r) => r.role === "client")) return "client";
  return null;
}

export function dashboardPathForRole(role: AppRole | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "vendeur":
      return "/vendeur";
    case "client":
      return "/client";
    default:
      return "/";
  }
}
