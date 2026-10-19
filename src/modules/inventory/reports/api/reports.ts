import { api } from "@/common/api";

export const REPORTS_PATH = "/inventory/reports";

export type LowStockRow = {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string;
  location: string | null;
  stockOnHand: number;
  reorderLevel: number;
  shortfall: number;
  averageUnitCost: number;
  lastVendor: string | null;
  lastUnitCost: number | null;
  lastReceivedOn: string | null;
};
export type LowStock = { asOf: string; items: LowStockRow[] };

export type ValuationRow = { categoryId: string; categoryName: string; itemCount: number; itemsInStock: number; stockValue: number };
export type Valuation = { asOf: string; currency: string; categories: ValuationRow[]; itemCount: number; totalValue: number };

export type ConsumptionRow = {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string;
  issuedQuantity: number;
  issuedValue: number;
  returnedQuantity: number;
  returnedValue: number;
  netQuantity: number;
  netValue: number;
};
export type Consumption = { from: string; to: string; items: ConsumptionRow[]; totals: { issuedValue: number; returnedValue: number; netValue: number } };

/* The same endpoint with ?format= returns the file (JSON without it) */
export const exportReport = (name: "low-stock" | "valuation" | "consumption", format: "csv" | "xlsx", query: Record<string, string> = {}) =>
  api.download(`${REPORTS_PATH}/${name}`, { ...query, format }, `${name}.${format}`);
