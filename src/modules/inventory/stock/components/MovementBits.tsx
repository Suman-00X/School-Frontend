import { Badge, type Tone } from "@/common/ui";
import { MOVEMENT_LABELS, signed, type MovementType } from "../../shared/utils/format";
import "../../shared/inventory.css";

const TONES: Record<MovementType, Tone> = { RECEIPT: "success", ISSUE: "info", RETURN: "primary", ADJUSTMENT: "warning" };

export function MovementTypeBadge({ type }: { type: MovementType }) {
  return <Badge tone={TONES[type]}>{MOVEMENT_LABELS[type]}</Badge>;
}

/* "+5 PCS" in green, "−2 PCS" in red */
export function Change({ value, unit }: { value: number; unit?: string | null }) {
  return (
    <span className={`in-num ${value >= 0 ? "in-plus" : "in-minus"}`}>
      {signed(value)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

