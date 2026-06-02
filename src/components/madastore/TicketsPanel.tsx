import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ArrowLeft } from "lucide-react";

type Ticket = { id: string; subject: string; category: string; status: string; created_at: string };
type Msg = { id: string; sender_id: string; is_admin: boolean; content: string; created_at: string };

const CATEGORIES = ["Commande", "Paiement", "Vendeur", "Compte", "Autre"];

export function TicketsPanel({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [firstMsg, setFirstMsg] = useState("");

  async function load() {
    let q = supabase.from("tickets").select("*").order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("user_id", userId);
    const { data } = await q;
    setTickets((data ?? []) as Ticket[]);
  }
  useEffect(() => {
    load();
  }, [userId, isAdmin]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("ticket_messages").select("*").eq("ticket_id", selected.id).order("created_at").then((r) => setMsgs((r.data ?? []) as Msg[]));
  }, [selected]);

  async function createTicket() {
    if (!subject.trim() || !firstMsg.trim()) return toast.error("Sujet et message requis");
    const { data, error } = await supabase.from("tickets").insert({ user_id: userId, subject, category }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("ticket_messages").insert({ ticket_id: data.id, sender_id: userId, content: firstMsg, is_admin: false });
    toast.success("Ticket ouvert");
    setShowNew(false);
    setSubject("");
    setFirstMsg("");
    load();
  }

  async function reply() {
    if (!selected || !text.trim()) return;
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: selected.id,
      sender_id: userId,
      content: text,
      is_admin: isAdmin,
    });
    if (error) return toast.error(error.message);
    if (isAdmin) await supabase.from("tickets").update({ status: "en_cours", updated_at: new Date().toISOString() }).eq("id", selected.id);
    setText("");
    supabase.from("ticket_messages").select("*").eq("ticket_id", selected.id).order("created_at").then((r) => setMsgs((r.data ?? []) as Msg[]));
  }

  async function setStatus(s: string) {
    if (!selected) return;
    await supabase.from("tickets").update({ status: s }).eq("id", selected.id);
    setSelected({ ...selected, status: s });
    load();
  }

  if (selected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h3 className="font-black">{selected.subject}</h3>
            <p className="text-xs text-muted-foreground">{selected.category} · {selected.status}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setStatus("resolu")} className="rounded-lg bg-mada-green px-3 py-1 text-xs font-bold text-secondary-foreground">Résoudre</button>
            <button onClick={() => setStatus("ferme")} className="rounded-lg border border-border px-3 py-1 text-xs font-bold">Fermer</button>
          </div>
        )}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${(m.is_admin ? !isAdmin : m.sender_id === userId) ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.is_admin ? "bg-mada-green/10 text-foreground" : "bg-mada-red/10"}`}>
                <div className="text-[10px] font-bold uppercase opacity-70">{m.is_admin ? "Support" : "Vous"}</div>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Répondre..." className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm" />
          <button onClick={reply} className="rounded-xl bg-mada-red px-4 py-2 text-sm font-bold text-primary-foreground">Envoyer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <button onClick={() => setShowNew((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-mada-red px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Nouveau ticket
        </button>
      )}
      {showNew && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea value={firstMsg} onChange={(e) => setFirstMsg(e.target.value)} placeholder="Décrivez votre problème..." rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={createTicket} className="w-full rounded-xl bg-mada-green py-2 text-sm font-black text-secondary-foreground">Ouvrir le ticket</button>
        </div>
      )}
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Aucun ticket.</div>
      ) : (
        tickets.map((t) => (
          <button key={t.id} onClick={() => setSelected(t)} className="block w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-mada-red">
            <div className="flex justify-between">
              <div className="font-bold text-sm">{t.subject}</div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "resolu" || t.status === "ferme" ? "bg-mada-green/15 text-mada-green" : "bg-yellow-100 text-yellow-800"}`}>{t.status}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleDateString("fr-FR")}</div>
          </button>
        ))
      )}
    </div>
  );
}
