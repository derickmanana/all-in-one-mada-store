import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps } from "@/lib/maps";
import { ProtectedShell } from "@/components/madastore/ProtectedShell";
import { formatMGA } from "@/components/madastore/Money";
import { ArrowLeft, Truck, MapPin, Package, Clock } from "lucide-react";

export const Route = createFileRoute("/order/$id/tracking")({ component: TrackingPage });

type OrderDetail = {
  id: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  total_mga: number;
  status: string;
  tracking_status: string | null;
  shipping_mode: string | null;
  courier_name: string | null;
  coop_name: string | null;
  depart_city: string | null;
  depart_at: string | null;
  eta_at: string | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  shipped_at: string | null;
  vendor_id: string;
  addresses: any;
  vendor_profiles: any;
};

const STEPS = [
  { id: "prepare", label: "📦 Préparé" },
  { id: "shipped", label: "🚚 Expédié" },
  { id: "in_transit", label: "🛣️ En transit" },
  { id: "arrived", label: "📍 Arrivé" },
  { id: "delivered", label: "✅ Livré" },
];

function TrackingPage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, product_title, product_image, quantity, total_mga, status, tracking_status, shipping_mode, courier_name, coop_name, depart_city, depart_at, eta_at, delivery_days_min, delivery_days_max, shipped_at, vendor_id, addresses(*), vendor_profiles!orders_vendor_id_fkey(shop_name, pickup_lat, pickup_lng, pickup_city)" as any)
        .eq("id", id)
        .maybeSingle();
      if (error) setErr(error.message);
      else setOrder(data as any);
    })();
  }, [id]);

  // Ticker for progress recalculation
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Progress %
  const now = Date.now();
  const depart = order?.depart_at ? new Date(order.depart_at).getTime() : null;
  const eta = order?.eta_at ? new Date(order.eta_at).getTime() : null;
  let progress = 0;
  if (order?.tracking_status === "delivered" || order?.status === "livre") progress = 1;
  else if (depart && eta && eta > depart) progress = Math.min(1, Math.max(0, (now - depart) / (eta - depart)));

  const remainingMs = eta ? Math.max(0, eta - now) : 0;
  const remainingH = Math.floor(remainingMs / 3600000);
  const remainingD = Math.floor(remainingH / 24);
  const remainingHr = remainingH % 24;

  // Map
  useEffect(() => {
    if (!order || !mapRef.current) return;
    const v = order.vendor_profiles;
    const a = order.addresses;
    if (!v?.pickup_lat || !v?.pickup_lng || !a?.latitude || !a?.longitude) return;

    let cancelled = false;
    loadGoogleMaps().then((google) => {
      if (cancelled || !mapRef.current) return;
      const from = { lat: Number(v.pickup_lat), lng: Number(v.pickup_lng) };
      const to = { lat: Number(a.latitude), lng: Number(a.longitude) };
      const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
      const map = new google.maps.Map(mapRef.current, {
        center: mid, zoom: 7, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      new google.maps.Marker({ position: from, map, label: "A", title: "Départ vendeur" });
      new google.maps.Marker({ position: to, map, label: "B", title: "Destination" });
      new google.maps.Polyline({
        path: [from, to], geodesic: true, strokeColor: "#FC3D32", strokeOpacity: 0.9, strokeWeight: 3, map,
      });
      const truckPos = { lat: from.lat + (to.lat - from.lat) * progress, lng: from.lng + (to.lng - from.lng) * progress };
      new google.maps.Marker({
        position: truckPos, map, title: "Colis",
        label: { text: "🚚", fontSize: "22px" },
      });
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(from); bounds.extend(to);
      map.fitBounds(bounds, 60);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [order, progress]);

  if (err) return <ProtectedShell expectedRole={undefined as any} title="Suivi"><div className="p-4 text-destructive">{err}</div></ProtectedShell>;
  if (!order) return <ProtectedShell expectedRole={undefined as any} title="Suivi"><div className="p-4">Chargement…</div></ProtectedShell>;

  const currentStep = order.tracking_status || "prepare";
  const stepIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <ProtectedShell expectedRole={undefined as any} title="Suivi de livraison">
      <div className="mb-3">
        <Link to="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </div>

      <div className="space-y-4 pb-20">
        {/* Product */}
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          {order.product_image && <img src={order.product_image} alt="" className="h-16 w-16 rounded-xl object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="line-clamp-2 text-sm font-bold">{order.product_title}</div>
            <div className="text-xs text-muted-foreground">Qté: {order.quantity}</div>
            <div className="text-sm font-black text-mada-red">{formatMGA(order.total_mga)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <span>Progression</span><span className="text-mada-green">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-mada-red to-mada-green transition-all duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-center">
            {STEPS.map((s, i) => (
              <div key={s.id} className={i <= stepIdx ? "font-bold text-mada-green" : "text-muted-foreground"}>{s.label}</div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div ref={mapRef} className="h-72 w-full bg-muted" />
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3 space-y-1 text-xs">
            <div className="font-black text-sm flex items-center gap-1"><Truck className="h-4 w-4 text-mada-green" /> Livraison</div>
            <div><b>Mode:</b> {order.shipping_mode ?? "—"}</div>
            <div><b>Livreur:</b> {order.courier_name ?? "—"}</div>
            {order.coop_name && <div><b>Coopérative:</b> {order.coop_name}</div>}
            <div><b>Départ:</b> {order.depart_city ?? order.vendor_profiles?.pickup_city ?? "—"} {order.depart_at && ` · ${new Date(order.depart_at).toLocaleString("fr-FR")}`}</div>
            {order.eta_at && <div><b>Arrivée estimée:</b> {new Date(order.eta_at).toLocaleString("fr-FR")}</div>}
            <div className="flex items-center gap-1 text-mada-red font-bold pt-1">
              <Clock className="h-3 w-3" />
              {progress >= 1 ? "Arrivé" : remainingD > 0 ? `${remainingD}j ${remainingHr}h restants` : `${remainingH}h restants`}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 space-y-1 text-xs">
            <div className="font-black text-sm flex items-center gap-1"><MapPin className="h-4 w-4 text-mada-red" /> Destination</div>
            {order.addresses ? (
              <>
                <div className="font-bold">{order.addresses.full_name} · {order.addresses.phone}</div>
                <div>{[order.addresses.street, order.addresses.quartier, order.addresses.city, order.addresses.district, order.addresses.region, order.addresses.province].filter(Boolean).join(", ")}</div>
                {order.addresses.details && <div className="italic text-muted-foreground">{order.addresses.details}</div>}
              </>
            ) : <div className="text-muted-foreground">Adresse non renseignée</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 text-xs flex items-center gap-2">
          <Package className="h-4 w-4 text-mada-green" />
          <span>Statut colis: <b>{STEPS[stepIdx]?.label ?? "Préparé"}</b></span>
        </div>
      </div>
    </ProtectedShell>
  );
}
