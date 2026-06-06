import { createServerFn } from "@tanstack/react-start";

type QuoteInput = {
  vendor_lat: number;
  vendor_lng: number;
  client_lat: number;
  client_lng: number;
  base_mga: number;
  per_km_mga: number;
};

// Compute shipping quote using Google Routes API (real driving distance via Lovable gateway).
// Falls back to haversine if the gateway / API call fails.
export const getShippingQuote = createServerFn({ method: "POST" })
  .inputValidator((d: QuoteInput) => {
    if (
      typeof d?.vendor_lat !== "number" ||
      typeof d?.vendor_lng !== "number" ||
      typeof d?.client_lat !== "number" ||
      typeof d?.client_lng !== "number"
    ) {
      throw new Error("Invalid coordinates");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    const haversine = () => {
      const R = 6371;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(data.client_lat - data.vendor_lat);
      const dLng = toRad(data.client_lng - data.vendor_lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(data.vendor_lat)) * Math.cos(toRad(data.client_lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    const buildResult = (km: number, durationMin: number | null, source: string) => {
      const fee = Math.round(data.base_mga + km * data.per_km_mga);
      const daysMin = km < 30 ? 1 : km < 150 ? 2 : km < 500 ? 4 : 6;
      const daysMax = daysMin + 2;
      return {
        km: Math.round(km * 10) / 10,
        fee_mga: fee,
        duration_min: durationMin,
        days_min: daysMin,
        days_max: daysMax,
        source,
      };
    };

    if (!lovableKey || !mapsKey) {
      return buildResult(haversine(), null, "haversine");
    }

    try {
      const res = await fetch(
        "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: data.vendor_lat, longitude: data.vendor_lng } } },
            destination: { location: { latLng: { latitude: data.client_lat, longitude: data.client_lng } } },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        },
      );
      if (!res.ok) {
        console.error("Routes API", res.status, await res.text());
        return buildResult(haversine(), null, "haversine_fallback");
      }
      const j: any = await res.json();
      const route = j?.routes?.[0];
      const meters = route?.distanceMeters;
      const durStr = route?.duration as string | undefined;
      const seconds = durStr ? parseInt(durStr.replace("s", ""), 10) : null;
      if (!meters) return buildResult(haversine(), null, "haversine_no_route");
      return buildResult(meters / 1000, seconds ? Math.round(seconds / 60) : null, "routes_api");
    } catch (e) {
      console.error("getShippingQuote error", e);
      return buildResult(haversine(), null, "haversine_error");
    }
  });
