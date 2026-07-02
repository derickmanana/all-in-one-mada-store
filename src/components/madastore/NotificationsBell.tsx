import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications" as any)
      .select("id, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as any);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAll() {
    if (!user) return;
    await supabase.from("notifications" as any).update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }

  async function open1(n: Notif) {
    if (!n.read_at) {
      await supabase.from("notifications" as any).update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link as any });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg border border-border bg-background p-2 hover:border-mada-red hover:text-mada-red transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-mada-red px-1 text-[10px] font-black text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="font-black text-sm">Notifications</div>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[11px] font-bold text-mada-green">
                <CheckCheck className="h-3 w-3" /> Tout lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Aucune notification</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => open1(n)}
                  className={`flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left hover:bg-muted/40 ${!n.read_at ? "bg-mada-red/5" : ""}`}
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.read_at ? "transparent" : "#FC3D32" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{n.title}</div>
                    {n.body && <div className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
                  </div>
                  {n.read_at && <Check className="mt-1 h-3 w-3 text-muted-foreground" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
