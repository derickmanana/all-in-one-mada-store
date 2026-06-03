import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { AuthCard } from "@/components/madastore/AuthCard";

export const Route = createFileRoute("/auth/vendeur")({
  head: () => ({ meta: [{ title: "Espace Vendeur — ALL IN ONE MADA STORE" }] }),
  component: () => (
    <AuthCard
      variant="vendeur"
      title="Espace Vendeur"
      subtitle="Vendez et gagnez de l'argent"
      accent="green"
      icon={<Store className="h-6 w-6" />}
    />
  ),
});
