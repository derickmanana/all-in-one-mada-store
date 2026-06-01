import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { supabase } from "@/integrations/supabase/client";

type Vendor = {
  id: string;
  shop_name: string;
  phone: string;
  status: "en_attente" | "actif" | "rejete";
  created_at: string;
};

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("vendor_profiles")
      .select("id, shop_name, phone, status, created_at")
      .order("created_at", { ascending: false });
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: Vendor["status"]) {
    const { error } = await supabase.from("vendor_profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    load();
  }

  return (
    <ProtectedShell expectedRole="admin" title="Admin Console">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-red p-6 text-primary-foreground shadow-glow-red">
          <h1 className="text-2xl font-black">Console Administrateur</h1>
          <p className="text-sm opacity-90 mt-1">
            Validation des vendeurs et modération de la plateforme.
          </p>
        </div>

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black">Vendeurs ({vendors.length})</h2>
            <button
              onClick={load}
              className="text-xs font-semibold text-mada-red hover:underline"
            >
              Rafraîchir
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun vendeur inscrit pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Boutique</th>
                    <th className="py-2 pr-4">Téléphone</th>
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4">Inscription</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 font-semibold">{v.shop_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{v.phone || "—"}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 pr-4 text-right space-x-2">
                        {v.status !== "actif" && (
                          <button
                            onClick={() => updateStatus(v.id, "actif")}
                            className="rounded-lg bg-mada-green px-3 py-1.5 text-xs font-bold text-secondary-foreground hover:opacity-90"
                          >
                            Activer
                          </button>
                        )}
                        {v.status !== "rejete" && (
                          <button
                            onClick={() => updateStatus(v.id, "rejete")}
                            className="rounded-lg border border-destructive text-destructive px-3 py-1.5 text-xs font-bold hover:bg-destructive hover:text-destructive-foreground"
                          >
                            Rejeter
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}

function StatusBadge({ status }: { status: Vendor["status"] }) {
  const styles: Record<Vendor["status"], string> = {
    en_attente: "bg-yellow-100 text-yellow-800",
    actif: "bg-mada-green/15 text-mada-green",
    rejete: "bg-destructive/15 text-destructive",
  };
  const labels: Record<Vendor["status"], string> = {
    en_attente: "En attente",
    actif: "Actif",
    rejete: "Rejeté",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
