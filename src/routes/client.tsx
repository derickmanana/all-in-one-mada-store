import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { TabNav } from "@/components/madastore/TabNav";
import { MarketplaceFeed } from "@/components/madastore/MarketplaceFeed";
import { WalletPanel } from "@/components/madastore/WalletPanel";
import { OrdersList } from "@/components/madastore/OrdersList";
import { MessagesPanel } from "@/components/madastore/MessagesPanel";
import { ProfilePanel } from "@/components/madastore/ProfilePanel";
import { useAuth } from "@/lib/auth";
import { ShoppingBag, Wallet, Package, MessageCircle, User } from "lucide-react";

export const Route = createFileRoute("/client")({ component: ClientPage });

const TABS = [
  { id: "shop", label: "Shop", icon: <ShoppingBag className="h-5 w-5" /> },
  { id: "wallet", label: "Wallet", icon: <Wallet className="h-5 w-5" /> },
  { id: "orders", label: "Commandes", icon: <Package className="h-5 w-5" /> },
  { id: "messages", label: "Chat", icon: <MessageCircle className="h-5 w-5" /> },
  { id: "profile", label: "Profil", icon: <User className="h-5 w-5" /> },
];

function ClientPage() {
  const [tab, setTab] = useState("shop");
  const { user } = useAuth();

  return (
    <ProtectedShell expectedRole="client" title="Espace Client">
      <div className="pb-24">
        {user && tab === "shop" && <MarketplaceFeed />}
        {user && tab === "wallet" && <WalletPanel userId={user.id} />}
        {user && tab === "orders" && <OrdersList userId={user.id} role="client" />}
        {user && tab === "messages" && <MessagesPanel userId={user.id} />}
        {user && tab === "profile" && <ProfilePanel userId={user.id} />}
      </div>
      <TabNav tabs={TABS} active={tab} onChange={setTab} />
    </ProtectedShell>
  );
}
