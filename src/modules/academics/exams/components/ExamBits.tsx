import { useQueryClient } from "@tanstack/react-query";
import { Badge, useConfirm, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { deleteExam, EXAMS_PATH, examPath, type Exam } from "../api/exams";

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

/* Confirm, delete, refresh every exam list. -> true once removed (the caller may leave the exam's page) */
export function useRemoveExam() {
  const confirm = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  return async (exam: Exam, { onRemoved }: { onRemoved?: () => void } = {}) => {
    const ok = await confirm({
      title: `Remove ${exam.examName}?`,
      message:
        "The exam and its papers are removed. An exam with recorded marks, published results or a place in an assessment scheme can't be removed.",
      confirmLabel: "Remove exam",
      tone: "danger"
    });
    if (!ok) return false;
    try {
      const res = await deleteExam(exam.id);
      onRemoved?.();
      qc.removeQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(examPath(exam.id)) });
      await qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(EXAMS_PATH) });
      toast.success(res.message || `${exam.examName} removed`);
      return true;
    } catch (err) {
      toast.error(err);
      return false;
    }
  };
}
