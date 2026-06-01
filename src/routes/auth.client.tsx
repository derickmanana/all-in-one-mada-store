import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { AuthCard } from "@/components/madastore/AuthCard";

export const Route = createFileRoute("/auth/client")({
  head: () => ({ meta: [{ title: "Espace Client — ALL IN ONE MADA STORE" }] }),
  component: () => (
    <AuthCard
      variant="client"
      title="Espace Client"
      subtitle="Achetez facilement vos produits"
      accent="red"
      icon={<ShoppingBag className="h-6 w-6" />}
    />
  ),
});
