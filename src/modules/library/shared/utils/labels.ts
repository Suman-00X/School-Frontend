import type { Tone } from "@/common/ui";
import type { CopyStatus, FineMethod, HoldStatus, ItemType, LoanStatus, ScanResult } from "../api/types";

/* Words the desk uses for the library's enums (single place) */

export const ITEM_TYPES: ItemType[] = ["BOOK", "REFERENCE", "PERIODICAL", "MEDIA"];
export const LOANABLE_ITEM_TYPES = ITEM_TYPES.filter(t => t !== "REFERENCE");
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BOOK: "Book",
  REFERENCE: "Reference",
  PERIODICAL: "Periodical",
  MEDIA: "Media"
};
export const ITEM_TYPE_HINTS: Record<ItemType, string> = {
  BOOK: "Lent under the book rules",
  REFERENCE: "Read in the library, never lent",
  PERIODICAL: "Magazines and journals",
  MEDIA: "CDs, DVDs and other media"
};
export const itemTypeOptions = (types: ItemType[] = ITEM_TYPES) =>
  types.map(t => ({ value: t, label: ITEM_TYPE_LABELS[t], description: ITEM_TYPE_HINTS[t] }));

export const COPY_STATUSES: CopyStatus[] = ["AVAILABLE", "ISSUED", "ON_HOLD", "LOST", "DAMAGED", "WITHDRAWN", "MISSING"];
/* The ones a librarian sets by hand; ISSUED and ON_HOLD come from circulation */
export const MANUAL_COPY_STATUSES: CopyStatus[] = ["AVAILABLE", "LOST", "DAMAGED", "WITHDRAWN", "MISSING"];
export const COPY_STATUS_LABELS: Record<CopyStatus, string> = {
  AVAILABLE: "On the shelf",
  ISSUED: "On loan",
  ON_HOLD: "Held at the desk",
  LOST: "Lost",
  DAMAGED: "Damaged",
  WITHDRAWN: "Withdrawn",
  MISSING: "Missing"
};
export const COPY_STATUS_TONES: Record<CopyStatus, Tone> = {
  AVAILABLE: "success",
  ISSUED: "info",
  ON_HOLD: "warning",
  LOST: "danger",
  DAMAGED: "warning",
  WITHDRAWN: "neutral",
  MISSING: "danger"
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = { ISSUED: "On loan", RETURNED: "Returned", LOST: "Lost" };
export const LOAN_STATUS_TONES: Record<LoanStatus, Tone> = { ISSUED: "info", RETURNED: "neutral", LOST: "danger" };

export const HOLD_STATUSES: HoldStatus[] = ["WAITING", "READY", "FULFILLED", "CANCELLED", "EXPIRED"];
export const HOLD_STATUS_LABELS: Record<HoldStatus, string> = {
  WAITING: "Waiting",
  READY: "Ready to collect",
  FULFILLED: "Issued",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};
export const HOLD_STATUS_TONES: Record<HoldStatus, Tone> = {
  WAITING: "info",
  READY: "warning",
  FULFILLED: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral"
};

export const FINE_METHOD_LABELS: Record<FineMethod, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", LIBRARY_CREDIT: "Library credit" };

export const SCAN_RESULT_LABELS: Record<ScanResult, string> = { FOUND: "Found", UNEXPECTED: "Should be elsewhere", UNKNOWN: "Unknown code" };
export const SCAN_RESULT_TONES: Record<ScanResult, Tone> = { FOUND: "success", UNEXPECTED: "warning", UNKNOWN: "danger" };

/* Who may borrow: students and every employee (the backend's BORROWER_ROLES) */
export const STAFF_BORROWER_ROLES = [
  "TEACHER",
  "ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
  "STAFF",
  "HR_MANAGER",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "INVENTORY_MANAGER"
];
export const BORROWER_ROLES = ["STUDENT", ...STAFF_BORROWER_ROLES];

/* "1 day", "3 days" */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/* "1st", "2nd", "3rd", "11th" */
export const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/* Codes a scanner reads: an accession number (ACC-000001) or a barcode (3-64 letters, digits or -) */
export const ACCESSION = /^ACC-\d{6,}$/i;
export const SCAN_CODE = /^[A-Za-z0-9-]{3,64}$/;
export const codeQuery = (code: string) => {
  const c = code.trim();
  return ACCESSION.test(c) ? { accessionNumber: c.toUpperCase() } : { barcode: c };
};

/* Whole days from a to b (YYYY-MM-DD), inclusive of both */
export const daysInclusive = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000) + 1;

/* YYYY-MM-DD n days from a date (or today) */
export const addDaysIso = (n: number, from?: string) => {
  const d = from ? new Date(from + "T00:00:00") : new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* "" -> null, "12.5" -> 12.5 (NaN stays NaN, for the validator to catch) */
export const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/* A money string with at most 2 decimals, >= 0 */
export const isMoney = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());
export const isWhole = (v: string) => /^\d+$/.test(v.trim());
