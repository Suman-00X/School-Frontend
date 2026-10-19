import type { Option } from "@/common/ui";

/* Choices for the Region card. The current value is always kept, even when it is not listed. */

const CURRENCIES = [
  "INR", "USD", "EUR", "GBP", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "SGD", "MYR", "THB", "IDR", "PHP",
  "AUD", "NZD", "CAD", "JPY", "CNY", "HKD", "LKR", "NPR", "BDT", "PKR", "MVR", "ZAR", "KES", "NGN", "CHF"
];

const COUNTRIES = [
  "IN", "US", "GB", "AE", "SA", "QA", "KW", "OM", "BH", "SG", "MY", "TH", "ID", "PH", "AU", "NZ", "CA",
  "JP", "CN", "HK", "LK", "NP", "BD", "PK", "MV", "ZA", "KE", "NG", "CH", "DE", "FR", "IE"
];

const named = (codes: string[], type: "currency" | "region", current?: string | null) => {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(undefined, { type });
  } catch {
    /* old browser: codes only */
  }
  const list = current && !codes.includes(current) ? [current, ...codes] : codes;
  return list
    .map(code => ({ value: code, label: `${names?.of(code) ?? code} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const currencyOptions = (current?: string | null): Option[] => named(CURRENCIES, "currency", current);
export const countryOptions = (current?: string | null): Option[] => named(COUNTRIES, "region", current);

/* Chrome lists some zones by their old IANA names; the school stores the current ones */
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Godthab": "America/Nuuk",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Mendoza": "America/Argentina/Mendoza",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville"
};

let zones: string[] | null = null;

/* Every IANA zone the browser knows, by current name (UTC is not always among them) */
export function timeZones(): string[] {
  if (!zones) {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf("timeZone");
    } catch {
      list = ["Asia/Kolkata"];
    }
    list = [...new Set(list.map(z => RENAMED[z] ?? z))].sort();
    zones = list.includes("UTC") ? list : ["UTC", ...list];
  }
  return zones;
}

/* "GMT+05:30" for a zone now; "" where the browser can't say */
const offset = (zone: string) => {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find(p => p.type === "timeZoneName")?.value;
    return part === "GMT" ? "GMT+00:00" : (part ?? "");
  } catch {
    return "";
  }
};

let zoneChoices: Option[] | null = null;

/* Zones for a select, labelled with their offset, such as "Asia/Kolkata (GMT+05:30)" */
export function timeZoneOptions(current?: string | null): Option[] {
  if (!zoneChoices)
    zoneChoices = timeZones().map(z => {
      const o = offset(z);
      return { value: z, label: o ? `${z.replace(/_/g, " ")} (${o})` : z.replace(/_/g, " ") };
    });
  return current && !timeZones().includes(current) ? [{ value: current, label: current }, ...zoneChoices] : zoneChoices;
}
