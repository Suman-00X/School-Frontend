import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Skeleton, useToast } from "@/common/ui";
import { assignRollNumbers, ENROLLMENTS_PATH, orderLabel, type RollAssignment, type RollTarget } from "../api/rollNumbers";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* One line: the rule, what is covered and how many numbers change */
function summaryOf(p: RollAssignment) {
  const parts = [orderLabel(p.rule)];
  if (p.rule === "RESULT_RANK")
    parts.push(p.previousAcademicYear ? `results of ${p.previousAcademicYear.yearName}` : "no earlier year, so alphabetical");
  if (p.totals.sections > 1) parts.push(plural(p.totals.sections, "section"));
  parts.push(plural(p.totals.students, "student"));
  parts.push(p.totals.changed ? `${p.totals.changed} will change` : "nothing changes");
  return parts.join(" · ");
}

/* "Assign roll numbers": previews the new order (dryRun) for a section, a class or the whole year,
   then renumbers. Fixed body height: a reserved summary line and a scrolling table; errors go in
   the footer. Mount it when opened. */
export function RollNumbersDialog({ target, label, onClose }: { target: RollTarget; label: string; onClose: () => void }) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  /* Not under /academics/enrollments, so assigning doesn't refetch the preview it replaces */
  const preview = useQuery({
    queryKey: ["roll-number-preview", target, year?.id ?? null],
    queryFn: async () => (await assignRollNumbers({ target, dryRun: true })).data,
    gcTime: 0,
    staleTime: 0,
    retry: false
  });
  const assign = useApiMutation(assignRollNumbers, { invalidate: [ENROLLMENTS_PATH] });
  const p = preview.data;
  const ranked = p?.rule === "RESULT_RANK";
  const columns = ranked ? 5 : 4;
  const many = (p?.sections.length ?? 0) > 1;

  const submit = () =>
    assign.mutate(
      { target },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        }
      }
    );

  const status = preview.error ? errorMessage(preview.error) : assign.error ? errorMessage(assign.error) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`Assign roll numbers: ${label}`}
      footerStatus={status}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={assign.isPending} disabled={!p || !p.totals.students} onClick={submit}>
            {p?.totals.changed ? `Assign (${p.totals.changed} change${p.totals.changed === 1 ? "" : "s"})` : "Assign"}
          </Button>
        </>
      }
    >
      <div className="roll-preview">
        <div className="roll-summary" title={p ? summaryOf(p) : undefined}>
          {p ? summaryOf(p) : preview.error ? "No preview" : <Skeleton width={320} />}
        </div>
        <p className="small muted roll-note">
          Each section is numbered from 1 in this order. Students who join later get the next number at the end; nobody is renumbered
          unless you assign again.
        </p>
        <div className="roll-table-wrap">
          <table className="table roll-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>New roll no.</th>
                <th>Name</th>
                <th style={{ width: 130 }}>Admission no.</th>
                <th style={{ width: 120 }}>Current</th>
                {ranked && (
                  <th className="align-right" style={{ width: 120 }}>
                    {p?.previousAcademicYear?.yearName ?? "Last year"} %
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {!p && !preview.error
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }, (_, j) => (
                        <td key={j}>
                          <Skeleton width="70%" />
                        </td>
                      ))}
                    </tr>
                  ))
                : p?.sections.map(s => (
                    <Fragment key={s.sectionId}>
                      {many && (
                        <tr className="roll-section-row">
                          <td colSpan={columns}>
                            <strong>{s.sectionName}</strong>
                            <span className="muted">
                              {" "}
                              · {plural(s.students, "student")} · {s.changed ? `${s.changed} will change` : "no change"}
                              {s.left ? ` · ${s.left} left (keep their place after)` : ""} · next {s.nextRollNumber}
                            </span>
                          </td>
                        </tr>
                      )}
                      {(s.order ?? []).map(r => {
                        const changed = r.rollNumber !== r.currentRollNumber;
                        return (
                          <tr key={r.enrollmentId} className={changed ? "roll-changed" : undefined}>
                            <td className="mono">
                              <strong>{r.rollNumber}</strong>
                            </td>
                            <td>{r.name}</td>
                            <td className="mono">{r.admissionNumber ?? "—"}</td>
                            <td className="mono muted">{changed ? <s>{r.currentRollNumber ?? "—"}</s> : r.currentRollNumber}</td>
                            {ranked && (
                              <td className="align-right">
                                {r.previousResult ? `${r.previousResult.percentage.toFixed(1)}%` : <span className="muted">No result</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!s.students && (
                        <tr>
                          <td colSpan={columns} className="muted">
                            No students in {s.sectionName} yet.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              {p && !p.sections.length && (
                <tr>
                  <td colSpan={columns} className="muted">
                    No sections in {p.academicYear.yearName}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
