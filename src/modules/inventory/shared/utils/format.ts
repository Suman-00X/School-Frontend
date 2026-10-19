/* Inventory display helpers: units, quantities, movement types */

export const UNITS = ["PCS", "BOX", "PACK", "KG", "G", "LITRE", "ML", "METRE", "SET", "REAM"] as const;
export type Unit = (typeof UNITS)[number];

/* Counted in whole numbers (no 2.5 PCS) */
export const COUNTABLE_UNITS: string[] = ["PCS", "BOX", "PACK", "SET", "REAM"];

export const UNIT_LABELS: Record<Unit, string> = {
  PCS: "Pieces",
  BOX: "Boxes",
  PACK: "Packs",
  KG: "Kilograms",
  G: "Grams",
  LITRE: "Litres",
  ML: "Millilitres",
  METRE: "Metres",
  SET: "Sets",
  REAM: "Reams"
};

export const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "RETURN", "ADJUSTMENT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIPT: "Received",
  ISSUE: "Issued",
  RETURN: "Returned",
  ADJUSTMENT: "Adjusted"
};

/* "3 PCS", "2.5 KG" (as the API words it) */
export const qty = (n: number | null | undefined, unit?: string | null) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

/* "+5", "−2" */
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 3 })}`;

/* Whole numbers for countable units, up to 3 decimals otherwise */
export const quantityProblem = (n: number, unit: string | undefined, { allowNegative = false } = {}) => {
  if (!Number.isFinite(n)) return "Enter a number";
  if (!allowNegative && n <= 0) return "Enter more than 0";
  if (allowNegative && n === 0) return "Can't be zero";
  if (unit && COUNTABLE_UNITS.includes(unit) && !Number.isInteger(n)) return `Whole ${unit} only`;
  if (Math.round(n * 1000) !== n * 1000) return "At most 3 decimals";
  return null;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/* New weighted average cost after receiving `q` at `cost` (same rule as the server) */
export const weightedAverage = (stock: number, average: number, q: number, cost: number) =>
  stock <= 0 ? round2(cost) : round2((stock * average + q * cost) / (stock + q));

export const personName = (p: { firstName?: string; lastName?: string } | null | undefined) => (p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "");
