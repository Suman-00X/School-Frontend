import type { Tone } from "@/common/ui";

/* Labels and colours for the hostel module's enums */

export const RESIDENT_GENDERS = ["BOYS", "GIRLS", "COED"] as const;
export type ResidentGender = (typeof RESIDENT_GENDERS)[number];
export const GENDER_LABELS: Record<ResidentGender, string> = { BOYS: "Boys", GIRLS: "Girls", COED: "Co-ed" };

export const ROOM_STATUSES = ["AVAILABLE", "MAINTENANCE", "CLOSED"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = { AVAILABLE: "Available", MAINTENANCE: "Maintenance", CLOSED: "Closed" };
export const ROOM_STATUS_TONES: Record<RoomStatus, Tone> = { AVAILABLE: "success", MAINTENANCE: "warning", CLOSED: "neutral" };

/* Derived from the dates and today */
export const PHASES = ["CURRENT", "UPCOMING", "ENDED", "CANCELLED"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = { CURRENT: "Current", UPCOMING: "Upcoming", ENDED: "Ended", CANCELLED: "Cancelled" };
export const PHASE_TONES: Record<Phase, Tone> = { CURRENT: "success", UPCOMING: "info", ENDED: "neutral", CANCELLED: "neutral" };

export const SOURCE_LABELS: Record<string, string> = { DIRECT: "Allocated", TRANSFER: "Transfer", ROLLOVER: "Roll-over" };

export const END_REASON_LABELS: Record<string, string> = {
  VACATED: "Vacated",
  RELEASED: "Handed back",
  TRANSFERRED: "Transferred",
  LEFT_SCHOOL: "Left school",
  CANCELLED: "Cancelled",
  BED_ENDED: "Bed ended"
};

export const RESOURCE_TYPES = ["LOCKER", "CUPBOARD", "STUDY_TABLE", "MESS_PLAN", "LAUNDRY_PLAN", "CUSTOM"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  LOCKER: "Locker",
  CUPBOARD: "Cupboard",
  STUDY_TABLE: "Study table",
  MESS_PLAN: "Mess plan",
  LAUNDRY_PLAN: "Laundry plan",
  CUSTOM: "Other"
};
/* Plans are hostel-wide; room items default to one holder */
export const PLAN_TYPES: ResourceType[] = ["MESS_PLAN", "LAUNDRY_PLAN"];
export const ROOM_ITEM_TYPES: ResourceType[] = ["LOCKER", "CUPBOARD", "STUDY_TABLE"];

export const RESOURCE_STATUSES = ["AVAILABLE", "OUT_OF_SERVICE"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = { AVAILABLE: "Available", OUT_OF_SERVICE: "Out of service" };

/* "Locker", or the custom type ("Bicycle stand") */
export const resourceTypeLabel = (r: { resourceType: string; customType?: string | null }) =>
  r.resourceType === "CUSTOM" && r.customType ? r.customType : (RESOURCE_TYPE_LABELS[r.resourceType as ResourceType] ?? r.resourceType);

export const studentName = (s: { user: { firstName: string; lastName: string } }) => `${s.user.firstName} ${s.user.lastName}`.trim();

export const floorLabel = (floor: number | null | undefined) =>
  floor === null || floor === undefined ? "No floor" : floor === 0 ? "Ground floor" : floor < 0 ? `Basement ${-floor}` : `Floor ${floor}`;

/* Day before / after a YYYY-MM-DD */
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
