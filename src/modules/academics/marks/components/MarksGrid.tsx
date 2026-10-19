import { useRef, type KeyboardEvent } from "react";
import { Select } from "@/common/ui";
import { componentLabel, type ExamPaper } from "../../exams/api/exams";
import { ABSENCE_LABELS, ABSENCE_REASONS, ABSENCE_SHORT, type AbsenceReason } from "../api/marks";
import { cellKey, EMPTY_CELL, sameCell, type Cell } from "../utils/cells";

export type GridStudent = {
  studentId: string;
  rollNumber: string | null;
  name: string;
  sub: string;
  left: boolean;
};
export type GridPaper = {
  paper: ExamPaper;
  grades: string[] | null;
  canEdit: boolean;
};

/* Keys that mark an absence in a marks cell */
const ABSENCE_KEYS: Record<string, AbsenceReason> = {
  a: "ABSENT",
  m: "MEDICAL",
  e: "EXEMPT"
};

const ABSENT_PREFIX = "@";
const ATTENDANCE_OPTIONS = [
  { value: "", label: "Present" },
  ...ABSENCE_REASONS.map(r => ({
    value: r,
    label: ABSENCE_LABELS[r],
    description: r === "EXEMPT" ? "Excused from this paper" : r === "MEDICAL" ? "Absent on medical grounds" : undefined
  }))
];

/* AC-14 grid: students down, papers across (or one paper with its attendance and remarks).
   Keyboard: Enter or ↓ moves down, ↑ up; in a marks cell A, M, E mark absent, medical or exempt
   and move down, and Delete clears the absence. Each row has one reserved line under the name for
   its error, so an error never moves the rows below. */
export function MarksGrid({
  students,
  papers,
  cells,
  originals,
  onChange,
  rowErrors,
  cellErrors,
  readOnly,
  detail,
  onOpenStudent
}: {
  students: GridStudent[];
  papers: GridPaper[];
  cells: Record<string, Cell>;
  originals: Record<string, Cell>;
  onChange: (studentId: string, paperId: string, patch: Partial<Cell>) => void;
  rowErrors: Record<string, string>;
  cellErrors: Record<string, string>;
  readOnly?: boolean;
  /* One paper: an attendance and a remarks column */
  detail?: boolean;
  onOpenStudent?: (studentId: string) => void;
}) {
  const ref = useRef<HTMLTableElement>(null);
  const navColumns = papers.length + (detail ? 1 : 0);

  const focus = (r: number, c: number) => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-nav="${r}:${c}"]`);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  };

  const move = (e: KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focus(Math.min(students.length - 1, r + 1), c);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(Math.max(0, r - 1), c);
      return true;
    }
    return false;
  };

  const marksKeys = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number, s: GridStudent, p: ExamPaper, cell: Cell) => {
    if (move(e, r, c)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const reason = ABSENCE_KEYS[e.key.toLowerCase()];
    if (reason) {
      e.preventDefault();
      onChange(s.studentId, p.id, { absence: reason, marks: "" });
      focus(Math.min(students.length - 1, r + 1), c);
      return;
    }
    if (cell.absence) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onChange(s.studentId, p.id, { absence: "" });
      } else if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        onChange(s.studentId, p.id, { absence: "", marks: e.key });
      }
    }
  };

  const gradeOptions = (grades: string[] | null, value: string) => {
    const list = grades ?? (value && !value.startsWith(ABSENT_PREFIX) ? [value] : []);
    return [
      ...list.map(g => ({ value: g, label: g })),
      ...ABSENCE_REASONS.map(r => ({
        value: ABSENT_PREFIX + r,
        label: `${ABSENCE_LABELS[r]} (${ABSENCE_SHORT[r]})`
      }))
    ];
  };

  return (
    <div className="table-wrap">
      <table ref={ref} className={`table marks-grid${detail ? " is-detail" : ""}`}>
        <thead>
          <tr>
            <th className="mg-roll">Roll</th>
            <th className="mg-name">Student</th>
            {papers.map(({ paper: p }) => (
              <th key={p.id} className="mg-paper" title={p.displayCode}>
                <div className="mg-paper-name">
                  {detail ? (p.gradingType === "GRADE" ? "Grade" : "Marks") : p.subject.subjectCode}
                  {!detail && p.component && <span className="muted"> · {componentLabel(p.component).slice(0, 4)}</span>}
                </div>
                <div className="mg-paper-max">{p.gradingType === "GRADE" ? "graded" : `out of ${p.maxMarks}`}</div>
              </th>
            ))}
            {detail && <th className="mg-attendance">Attendance</th>}
            {detail && <th className="mg-remarks">Remarks</th>}
          </tr>
        </thead>
        <tbody>
          {students.map((s, r) => {
            const error = rowErrors[s.studentId];
            return (
              <tr key={s.studentId} className={[error && "mg-row-error", s.left && "mg-row-left"].filter(Boolean).join(" ") || undefined}>
                <td className="mg-roll mono small">{s.rollNumber ?? "—"}</td>
                <td className="mg-name">
                  {onOpenStudent ? (
                    <button
                      type="button"
                      className="mg-student"
                      onClick={() => onOpenStudent(s.studentId)}
                      title="See this student's marks in the exam"
                    >
                      {s.name}
                    </button>
                  ) : (
                    <div className="mg-student">{s.name}</div>
                  )}
                  <div className={`mg-sub${error ? " is-error" : ""}`} title={error ?? s.sub}>
                    {error ?? s.sub}
                  </div>
                </td>
                {papers.map(({ paper: p, grades, canEdit }, c) => {
                  const key = cellKey(s.studentId, p.id);
                  const cell = cells[key] ?? EMPTY_CELL;
                  const dirty = !sameCell(cell, originals[key]);
                  const invalid = !!cellErrors[key];
                  const editable = canEdit && !readOnly && !s.left;
                  const cls = `mg-cell${dirty ? " is-dirty" : ""}${invalid ? " is-invalid" : ""}${cell.absence ? " is-absent" : ""}`;
                  if (p.gradingType === "GRADE") {
                    const value = cell.absence ? ABSENT_PREFIX + cell.absence : cell.grade;
                    return (
                      <td key={p.id} className={cls} title={cellErrors[key]}>
                        <Select
                          aria-label={`${p.subject.subjectName} grade for ${s.name}`}
                          className="select-sm mg-grade"
                          value={value}
                          placeholder="–"
                          disabled={!editable}
                          creatable={!grades}
                          options={gradeOptions(grades, value)}
                          onChange={e => {
                            const v = e.target.value;
                            if (v.startsWith(ABSENT_PREFIX))
                              onChange(s.studentId, p.id, {
                                absence: v.slice(1) as AbsenceReason,
                                grade: ""
                              });
                            else
                              onChange(s.studentId, p.id, {
                                absence: "",
                                grade: v.toUpperCase()
                              });
                          }}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={p.id} className={cls} title={cellErrors[key]}>
                      <input
                        data-nav={`${r}:${c}`}
                        className="input input-sm mg-input"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`${p.subject.subjectName} marks for ${s.name}, out of ${p.maxMarks}`}
                        aria-invalid={invalid || undefined}
                        disabled={!editable}
                        value={cell.absence ? ABSENCE_SHORT[cell.absence] : cell.marks}
                        onChange={e => {
                          if (!cell.absence)
                            onChange(s.studentId, p.id, {
                              marks: e.target.value.replace(",", ".")
                            });
                        }}
                        onKeyDown={e => marksKeys(e, r, c, s, p, cell)}
                        onFocus={e => e.target.select()}
                      />
                    </td>
                  );
                })}
                {detail &&
                  papers.slice(0, 1).map(({ paper: p, canEdit }) => {
                    const key = cellKey(s.studentId, p.id);
                    const cell = cells[key] ?? EMPTY_CELL;
                    const editable = canEdit && !readOnly && !s.left;
                    return [
                      <td key="attendance" className="mg-attendance">
                        <Select
                          aria-label={`Attendance of ${s.name}`}
                          className="select-sm"
                          value={cell.absence}
                          required
                          disabled={!editable}
                          options={ATTENDANCE_OPTIONS}
                          onChange={e =>
                            onChange(s.studentId, p.id, {
                              absence: e.target.value as AbsenceReason | "",
                              ...(e.target.value ? { marks: "", grade: "" } : {})
                            })
                          }
                        />
                      </td>,
                      <td key="remarks" className="mg-remarks">
                        <input
                          data-nav={`${r}:${navColumns}`}
                          className="input input-sm"
                          maxLength={500}
                          aria-label={`Remarks for ${s.name}`}
                          disabled={!editable}
                          value={cell.remarks}
                          onChange={e =>
                            onChange(s.studentId, p.id, {
                              remarks: e.target.value
                            })
                          }
                          onKeyDown={e => move(e, r, navColumns)}
                        />
                      </td>
                    ];
                  })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
