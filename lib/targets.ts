// Catering sales targets shown at /admin/targets.

export const TARGET_STATUSES = ["To visit", "Visited", "Follow up", "Customer", "Not interested"] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export interface CateringTarget {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  status: TargetStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Pin / badge colors per status (hex for map pins, Tailwind for badges).
export const TARGET_STATUS_COLORS: Record<TargetStatus, { hex: string; badge: string }> = {
  "To visit": { hex: "#dc2626", badge: "bg-red-600 text-white" },
  Visited: { hex: "#2563eb", badge: "bg-blue-600 text-white" },
  "Follow up": { hex: "#f59e0b", badge: "bg-amber-400 text-black" },
  Customer: { hex: "#16a34a", badge: "bg-green-600 text-white" },
  "Not interested": { hex: "#6b7280", badge: "bg-gray-300 text-gray-700" },
};

// Store location: Park City, UT. Used to center the map and bias search.
export const STORE_LOCATION = { lat: 40.6461, lng: -111.498 };

export function directionsUrl(t: Pick<CateringTarget, "name" | "address" | "place_id" | "lat" | "lng">): string {
  const p = new URLSearchParams({ api: "1" });
  p.set("destination", t.address ? `${t.name}, ${t.address}` : t.lat != null && t.lng != null ? `${t.lat},${t.lng}` : t.name);
  if (t.place_id) p.set("destination_place_id", t.place_id);
  return `https://www.google.com/maps/dir/?${p}`;
}
