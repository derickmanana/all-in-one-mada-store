import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { TabNav } from "@/components/madastore/TabNav";
import { VendorProductsManager } from "@/components/madastore/VendorProductsManager";
import { OrdersList } from "@/components/madastore/OrdersList";
import { VendorWalletPanel } from "@/components/madastore/VendorWalletPanel";
import { VendorPickupForm } from "@/components/madastore/VendorPickupForm";
import { MessagesPanel } from "@/components/madastore/MessagesPanel";
import { TicketsPanel } from "@/components/madastore/TicketsPanel";
import { SupportChat } from "@/components/madastore/SupportChat";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Wallet, MessageCircle, Sparkles, LifeBuoy, MapPin } from "lucide-react";

type Status = "en_attente" | "actif" | "rejete";

export const Route = createFileRoute("/vendeur")({ component: VendeurPage });

const TABS = [
  { id: "produits", label: "Produits", icon: <Package className="h-5 w-5" /> },
  { id: "commandes", label: "Cmd", icon: <ShoppingCart className="h-5 w-5" /> },
  { id: "wallet", label: "Wallet", icon: <Wallet className="h-5 w-5" /> },
  { id: "pickup", label: "GPS", icon: <MapPin className="h-5 w-5" /> },
  { id: "messages", label: "Chat", icon: <MessageCircle className="h-5 w-5" /> },
  { id: "ia", label: "IA", icon: <Sparkles className="h-5 w-5" /> },
  { id: "support", label: "Aide", icon: <LifeBuoy className="h-5 w-5" /> },
];

function VendeurPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("produits");
  const [status, setStatus] = useState<Status | null>(null);
  const [shop, setShop] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("vendor_profiles")
      .select("status, shop_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status as Status);
          setShop(data.shop_name);
        }
      });
  }, [user]);

  return (
    <ProtectedShell expectedRole="vendeur" title={shop || "Espace Vendeur"}>
      {status === "en_attente" && (
        <div className="mb-4 rounded-2xl border-2 border-mada-red/30 bg-mada-red/5 p-4 text-center text-sm">
          ⏳ <strong>Compte en attente de validation.</strong> Vous pourrez publier dès l'activation.
        </div>
      )}
      {status === "rejete" && (
        <div className="mb-4 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          ❌ Compte rejeté. Ouvrez un ticket pour contester.
        </div>
      )}
      <TabNav tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-2 pb-20 md:pb-0">
        {user && tab === "produits" && <VendorProductsManager vendorId={user.id} vendorActive={status === "actif"} />}
        {user && tab === "commandes" && <OrdersList userId={user.id} role="vendeur" />}
        {user && tab === "wallet" && <VendorWalletPanel userId={user.id} />}
        {user && tab === "messages" && <MessagesPanel userId={user.id} />}
        {user && tab === "ia" && <SupportChat />}
        {user && tab === "support" && <TicketsPanel userId={user.id} />}
      </div>
    </ProtectedShell>
  );
}
