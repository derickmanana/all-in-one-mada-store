import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { supabase } from "@/integrations/supabase/client";

type Status = "en_attente" | "actif" | "rejete";

export const Route = createFileRoute("/vendeur")({
  component: VendeurPage,
});

function VendeurPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [shop, setShop] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("vendor_profiles")
        .select("status, shop_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setStatus(data.status as Status);
        setShop(data.shop_name);
      }
    })();
  }, []);

  return (
    <ProtectedShell expectedRole="vendeur" title="Espace Vendeur">
      <div className="rounded-3xl border border-border bg-card p-10">
        <div className="text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h1 className="text-3xl font-black">Boutique : {shop || "..."}</h1>
        </div>

        <div className="mt-8 max-w-xl mx-auto">
          {status === "en_attente" && (
            <div className="rounded-2xl border-2 border-mada-red/30 bg-mada-red/5 p-6 text-center">
              <div className="text-2xl mb-2">⏳</div>
              <h2 className="font-bold text-lg text-mada-red">En attente de validation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Votre compte vendeur doit être validé par l'administrateur avant que vous puissiez publier
                des produits. Vous serez notifié dès l'activation.
              </p>
            </div>
          )}
          {status === "actif" && (
            <div className="rounded-2xl border-2 border-mada-green/30 bg-mada-green/5 p-6 text-center">
              <div className="text-2xl mb-2">✅</div>
              <h2 className="font-bold text-lg text-mada-green">Compte actif</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Le dashboard complet (produits, commandes, wallet) arrivera en Phase 2.
              </p>
            </div>
          )}
          {status === "rejete" && (
            <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
              <h2 className="font-bold text-lg text-destructive">Compte rejeté</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Contactez le support pour plus d'informations.
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedShell>
  );
}
