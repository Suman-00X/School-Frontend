import { Badge } from "@/common/ui";
import { useMoney } from "../../shared/hooks/useMoney";
import type { Calculation, ComponentKind } from "../api/payroll";

export function KindBadge({ kind }: { kind: ComponentKind }) {
  return kind === "EARNING" ? <Badge tone="success">Earning</Badge> : <Badge tone="danger">Deduction</Badge>;
}

/* "12% of basic" or "₹1,600.00" */
export function CalculationText({ calculation, value }: { calculation: Calculation; value: number }) {
  const money = useMoney();
  return <span className="nowrap">{calculation === "PERCENT_OF_BASIC" ? `${value}% of basic` : money(value)}</span>;
}

export function RunStatusBadge({ status }: { status: "DRAFT" | "FINALIZED" | undefined }) {
  if (!status) return null;
  return status === "DRAFT" ? (
    <Badge tone="warning" dot>
      Draft
    </Badge>
  ) : (
    <Badge tone="success" dot>
      Finalized
    </Badge>
  );
}
