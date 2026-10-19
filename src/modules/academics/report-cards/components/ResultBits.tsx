import { Badge } from "@/common/ui";
import { POLICY_SOURCE_LABELS } from "../../exams/api/grading";
import { RESULT_LABELS, RESULT_TONES, type ResultStatus, type SheetPolicy, type SubjectLine } from "../api/reportCards";

export function ResultBadge({ result }: { result: ResultStatus | null | undefined }) {
  if (!result) return <span className="muted">—</span>;
  return (
    <Badge tone={RESULT_TONES[result]} dot>
      {RESULT_LABELS[result]}
    </Badge>
  );
}

/* A subject's figure in a sheet cell: AB / EX / – or the marks (or grade) */
export function LineValue({ line, showMarks }: { line: SubjectLine | undefined; showMarks: boolean }) {
  if (!line) return <span className="muted">—</span>;
  if (line.status === "NOT_RECORDED")
    return (
      <span className="muted" title="Not entered yet">
        –
      </span>
    );
  if (line.status === "ABSENT")
    return (
      <span title="Absent" className="rc-ab">
        AB
      </span>
    );
  if (line.status === "EXEMPT")
    return (
      <span title="Exempt" className="rc-ex">
        EX
      </span>
    );
  if (!showMarks || line.category === "CO_SCHOLASTIC" || line.marksAwarded === undefined || line.marksAwarded === null)
    return line.grade ?? <span className="muted">—</span>;
  return (
    <span className={line.passed === false ? "rc-failed" : undefined} title={line.passed === false ? "Below the pass mark" : undefined}>
      {line.marksAwarded}
      {line.graceMarks ? <sup title={`Includes ${line.graceMarks} grace`}>+{line.graceMarks}</sup> : null}
    </span>
  );
}

export function PolicyLine({ policy, scale }: { policy: SheetPolicy | null | undefined; scale?: { name: string } | null }) {
  if (!policy) return null;
  return (
    <span className="small muted" title={policy.name}>
      Rules: {policy.name} ({POLICY_SOURCE_LABELS[policy.source] ?? policy.source}){scale ? ` · Grade scale: ${scale.name}` : ""}
    </span>
  );
}
