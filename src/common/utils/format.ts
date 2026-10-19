/* Display helpers. Dates from the API are "YYYY-MM-DD" (school days) or ISO timestamps. */

type Named = { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null | undefined;

export const fullName = (p: Named, withMiddle = false) =>
  p ? [p.firstName, withMiddle ? p.middleName : null, p.lastName].filter(Boolean).join(" ") : "";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("") || "?";

/* "FULL_TIME" → "Full time" */
export const enumLabel = (value: string | null | undefined) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : "";

export const enumOptions = (values: readonly string[], labels?: Record<string, string>) =>
  values.map(v => ({ value: v, label: labels?.[v] ?? enumLabel(v) }));

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/* A school day ("2026-10-19") is shown as is in the local calendar, never shifted by time zone */
const toDate = (value: string) => (DATE_ONLY.test(value) ? new Date(value + "T00:00:00") : new Date(value));

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "";
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(value);
}

export function formatMoney(amount: number | string | null | undefined, currency = "INR") {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* Today as YYYY-MM-DD in the device's calendar */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* Browser and OS from a user agent, for the devices list */
export function describeUserAgent(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl|node|undici/i.test(ua)
            ? "API client"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
