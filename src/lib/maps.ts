// Google Maps JS loader (singleton). Loads async with callback.
declare global {
  interface Window {
    google?: any;
    __mada_initMap?: () => void;
  }
}

let promise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (promise) return promise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps key missing"));

  promise = new Promise((resolve, reject) => {
    window.__mada_initMap = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__mada_initMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Maps load failed"));
    document.head.appendChild(s);
  });
  return promise;
}

// Madagascar bounding box (approx)
export const MG_BOUNDS = { south: -25.7, west: 42.5, north: -11.8, east: 51.0 };
export function inMadagascar(lat: number, lng: number) {
  return lat >= MG_BOUNDS.south && lat <= MG_BOUNDS.north && lng >= MG_BOUNDS.west && lng <= MG_BOUNDS.east;
}

export function parseAddressComponents(comps: any[] = []): {
  province?: string; region?: string; district?: string; city?: string; quartier?: string; street?: string;
} {
  const get = (type: string) => comps.find((c) => c.types?.includes(type))?.long_name;
  return {
    province: get("administrative_area_level_1"),
    region: get("administrative_area_level_2"),
    district: get("administrative_area_level_3"),
    city: get("locality") || get("postal_town"),
    quartier: get("sublocality") || get("sublocality_level_1") || get("neighborhood"),
    street: [get("route"), get("street_number")].filter(Boolean).join(" "),
  };
}
