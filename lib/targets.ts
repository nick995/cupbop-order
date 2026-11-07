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
  contact_name?: string | null;      // optional until the sales-tracking columns exist
  next_follow_up?: string | null;    // YYYY-MM-DD
  last_visited_at?: string | null;
  owner?: string | null;             // staff name; missing until the owner column exists
  created_at: string;
  updated_at: string;
}

// Whose list a place is on. Several logins can belong to one person.
export const STAFF = [
  { name: "MinGyu", emails: ["mjung@cupbop.com", "mingyu995@gmail.com"] },
  { name: "Ryan", emails: ["lryan@cupbop.com"] },
] as const;
export const DEFAULT_OWNER = STAFF[0].name;

export function staffName(email: string): string {
  const e = email.trim().toLowerCase();
  const person = STAFF.find((s) => (s.emails as readonly string[]).includes(e));
  if (person) return person.name;
  const local = e.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export const ownerOf = (t: Pick<CateringTarget, "owner">) => t.owner || DEFAULT_OWNER;

export const ACTIVITY_KINDS = ["visit", "call", "email", "note", "status", "order"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface TargetActivity {
  id: string;
  target_id: string;
  kind: ActivityKind;
  status: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export const ACTIVITY_LABELS: Record<ActivityKind, { icon: string; label: string }> = {
  visit: { icon: "🚶", label: "Visited" },
  call: { icon: "📞", label: "Called" },
  email: { icon: "✉️", label: "Emailed" },
  note: { icon: "📝", label: "Note" },
  status: { icon: "🔁", label: "Status" },
  order: { icon: "🧾", label: "Order" },
};

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
