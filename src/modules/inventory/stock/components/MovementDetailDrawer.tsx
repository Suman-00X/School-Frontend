import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { useAuth } from "@/common/auth";
import { DescriptionList, Drawer, RoleBadge } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { personName, qty } from "../../shared/utils/format";
import type { Movement } from "../api/stock";
import { Change, MovementTypeBadge } from "./MovementBits";

/* IN-04 movement drawer: read-only (movements are never edited; a correction is an adjustment) */
export function MovementDetailDrawer({ movement: m, onClose }: { movement: Movement | null; onClose: () => void }) {
  const { can } = useAuth();
  const money = useMoney();
  return (
    <Drawer open={!!m} onClose={onClose} title={m ? m.movementNumber : ""} subtitle={m && <MovementTypeBadge type={m.type} />}>
      {m && (
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              {
                label: "Item",
                value: m.item && (
                  <Link to={`/inventory/items/${m.item.id}`}>
                    {m.item.name} <span className="mono small muted">{m.item.sku}</span>
                  </Link>
                ),
                wide: true
              },
              { label: "Date", value: formatDate(m.movementDate) },
              { label: "Change", value: <Change value={m.quantityChange} unit={m.item?.unit} /> },
              { label: "Balance after", value: qty(m.balanceAfter, m.item?.unit) },
              { label: "Unit cost", value: money(m.unitCost) },
              { label: "Value", value: money(m.totalValue) },
              { label: "Average cost after", value: money(m.averageCostAfter) },
              { label: "Vendor", value: m.vendor?.name, hidden: m.type !== "RECEIPT" },
              {
                label: m.type === "RETURN" ? "Returned by" : "Issued to",
                value: m.issuedToUser ? (
                  <span className="row" style={{ gap: 6 }}>
                    {personName(m.issuedToUser)} <RoleBadge role={m.issuedToUser.role} />
                  </span>
                ) : (
                  m.issuedTo
                ),
                hidden: m.type !== "ISSUE" && m.type !== "RETURN"
              },
              { label: "Reason", value: m.reason, wide: true },
              { label: "Reference", value: m.reference },
              { label: "Recorded by", value: m.creator && `${personName(m.creator)}, ${formatDateTime(m.createdAt)}` }
            ]}
          />
          <p className="small muted">Movements can't be edited or removed. To correct one, record an adjustment.</p>
          {can("inventory.activity.read") && (
            <Link className="row small" style={{ gap: 6 }} to={`/inventory/activity?entityId=${m.id}`}>
              <History size={14} /> History of this movement
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
