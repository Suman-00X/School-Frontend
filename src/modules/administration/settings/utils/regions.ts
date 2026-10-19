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

let zones: string[] | null = null;

/* Every IANA zone the browser knows (UTC is not always among them) */
export function timeZones(): string[] {
  if (!zones) {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf("timeZone");
    } catch {
      list = ["Asia/Kolkata"];
    }
    zones = list.includes("UTC") ? list : ["UTC", ...list];
  }
  return zones;
}
