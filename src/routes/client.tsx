import { createFileRoute } from "@tanstack/react-router";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";

export const Route = createFileRoute("/client")({
  component: () => (
    <ProtectedShell expectedRole="client" title="Espace Client">
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <div className="text-5xl mb-4">🛍️</div>
        <h1 className="text-3xl font-black">Bienvenue sur ALL IN ONE MADA STORE</h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          Le catalogue produits, le panier et le wallet arriveront en Phase 2.
        </p>
      </div>
    </ProtectedShell>
  ),
});
