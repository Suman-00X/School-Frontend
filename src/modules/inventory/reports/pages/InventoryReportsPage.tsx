/* IN-05 · Inventory reports: low stock, valuation and consumption, each exportable */
import { useSearchParams } from "react-router-dom";
import { Page, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { ConsumptionPanel } from "../components/ConsumptionPanel";
import { LowStockPanel } from "../components/LowStockPanel";
import { ValuationPanel } from "../components/ValuationPanel";
import "../../shared/inventory.css";

const TABS: TabItem[] = [
  { id: "low-stock", label: "Low stock" },
  { id: "valuation", label: "Valuation" },
  { id: "consumption", label: "Consumption" }
];

const INTRO: Record<string, string> = {
  "low-stock": "Items at or below their reorder level, largest shortfall first. Discontinued items are left out.",
  valuation: "What the stock on the shelves is worth at average cost, by category.",
  consumption: "What was issued and taken back over a period, at the cost when it moved."
};

export default function InventoryReportsPage() {
  const [, setSearch] = useSearchParams();
  const [tab] = useTabParam(TABS);
  const switchTab = (id: string) => setSearch(id === TABS[0]!.id ? {} : { tab: id }, { replace: true });
  return (
    <Page>
      <PageIntro>{INTRO[tab]}</PageIntro>
      <Tabs tabs={TABS} value={tab} onChange={switchTab} />
      {tab === "low-stock" ? <LowStockPanel /> : tab === "valuation" ? <ValuationPanel /> : <ConsumptionPanel />}
    </Page>
  );
}
