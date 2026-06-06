import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { TabNav } from "@/components/madastore/TabNav";
import { MarketplaceFeed } from "@/components/madastore/MarketplaceFeed";
import { WalletPanel } from "@/components/madastore/WalletPanel";
import { OrdersList } from "@/components/madastore/OrdersList";
import { MessagesPanel } from "@/components/madastore/MessagesPanel";
import { SupportChat } from "@/components/madastore/SupportChat";
import { TicketsPanel } from "@/components/madastore/TicketsPanel";
import { AddressesPanel } from "@/components/madastore/AddressesPanel";
import { useAuth } from "@/lib/auth";
import { ShoppingBag, Wallet, Package, MessageCircle, Sparkles, LifeBuoy, MapPin } from "lucide-react";

export const Route = createFileRoute("/client")({ component: ClientPage });

const TABS = [
  { id: "shop", label: "Shop", icon: <ShoppingBag className="h-5 w-5" /> },
  { id: "wallet", label: "Wallet", icon: <Wallet className="h-5 w-5" /> },
  { id: "orders", label: "Cmd", icon: <Package className="h-5 w-5" /> },
  { id: "addresses", label: "Adr.", icon: <MapPin className="h-5 w-5" /> },
  { id: "messages", label: "Chat", icon: <MessageCircle className="h-5 w-5" /> },
  { id: "ai", label: "IA", icon: <Sparkles className="h-5 w-5" /> },
  { id: "support", label: "Aide", icon: <LifeBuoy className="h-5 w-5" /> },
];

function ClientPage() {
  const [tab, setTab] = useState("shop");
  const { user } = useAuth();

  return (
    <ProtectedShell expectedRole="client" title="Espace Client">
      <TabNav tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-2 pb-20 md:pb-0">
        {user && tab === "shop" && <MarketplaceFeed />}
        {user && tab === "wallet" && <WalletPanel userId={user.id} />}
        {user && tab === "orders" && <OrdersList userId={user.id} role="client" />}
        {user && tab === "addresses" && <AddressesPanel userId={user.id} />}
        {user && tab === "messages" && <MessagesPanel userId={user.id} />}
        {user && tab === "ai" && <SupportChat />}
        {user && tab === "support" && <TicketsPanel userId={user.id} />}
      </div>
    </ProtectedShell>
  );
}
