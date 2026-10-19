import type { Tone } from "@/common/ui";

/* Display helpers shared by the transport submodules */

/* "07:30:00" -> "07:30" */
export const hhmm = (time: string | null | undefined) => (time ? time.slice(0, 5) : "");

/* "07:10 / 15:40", with a dash for a missing time */
export const timesLabel = (pickup: string | null | undefined, drop: string | null | undefined) =>
  `${hhmm(pickup) || "–"} / ${hhmm(drop) || "–"}`;

export const DIRECTIONS = ["BOTH", "PICKUP_ONLY", "DROP_ONLY"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABELS: Record<Direction, string> = {
  BOTH: "Both ways",
  PICKUP_ONLY: "Pickup only",
  DROP_ONLY: "Drop only"
};

export const DIRECTION_OPTIONS = DIRECTIONS.map(d => ({
  value: d,
  label: DIRECTION_LABELS[d],
  description: d === "BOTH" ? "To school and back home" : d === "PICKUP_ONLY" ? "Morning trip only" : "Afternoon trip only"
}));

export const directionLabel = (d: string | null | undefined) => (d ? (DIRECTION_LABELS[d as Direction] ?? d) : "");

export const VEHICLE_STATUSES = ["ACTIVE", "IN_MAINTENANCE", "RETIRED"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  ACTIVE: "Active",
  IN_MAINTENANCE: "In maintenance",
  RETIRED: "Retired"
};

export const VEHICLE_STATUS_TONES: Record<VehicleStatus, Tone> = { ACTIVE: "success", IN_MAINTENANCE: "warning", RETIRED: "neutral" };

/* "Route R1" (the name when a route has no code), as the server writes it in messages */
export const routeLabel = (r: { code?: string | null; name: string }) => `Route ${r.code ?? r.name}`;
