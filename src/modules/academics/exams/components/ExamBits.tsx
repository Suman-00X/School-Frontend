import { Badge } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import type { Exam } from "../api/exams";

export function ResultsBadge({ exam }: { exam: Pick<Exam, "resultsPublishedAt"> }) {
  return exam.resultsPublishedAt ? (
    <span title={`Published ${formatDateTime(exam.resultsPublishedAt)}`}>
      <Badge tone="success" dot>
        Results published
      </Badge>
    </span>
  ) : (
    <Badge>Not published</Badge>
  );
}
