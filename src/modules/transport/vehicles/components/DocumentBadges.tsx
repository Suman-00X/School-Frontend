import { Badge } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { ExpiringDocument } from "../api/vehicles";
import "../../shared/components/transport.css";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* "Insurance expired 3 days ago" (red), "Permit in 12 days" (amber) */
export const documentText = (d: ExpiringDocument) => {
  if (d.isExpired) return `${d.label} expired ${plural(-d.daysLeft, "day")} ago`;
  if (d.daysLeft === 0) return `${d.label} expires today`;
  return `${d.label} in ${plural(d.daysLeft, "day")}`;
};

export function DocumentBadges({ documents }: { documents: ExpiringDocument[] }) {
  if (!documents.length) return <span className="muted">—</span>;
  return (
    <span className="doc-badges">
      {documents.map(d => (
        <span key={d.document} title={`${d.label}: ${formatDate(d.expiresOn)}`}>
          <Badge tone={d.isExpired ? "danger" : "warning"}>{documentText(d)}</Badge>
        </span>
      ))}
    </span>
  );
}
