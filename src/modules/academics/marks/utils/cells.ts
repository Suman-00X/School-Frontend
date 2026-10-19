import type { ExamPaper } from "../../exams/api/exams";
import { type AbsenceReason, type MarkEntry, type MarkRecord } from "../api/marks";

/* One student's entry for one paper, as edited in the grid (strings, so a half-typed "12." is kept) */
export type Cell = {
  marks: string;
  grade: string;
  absence: AbsenceReason | "";
  remarks: string;
};

export const EMPTY_CELL: Cell = {
  marks: "",
  grade: "",
  absence: "",
  remarks: ""
};

export const cellKey = (studentId: string, paperId: string) => `${studentId}:${paperId}`;

const norm = (c: Cell | undefined): Cell => ({
  marks: (c?.marks ?? "").trim(),
  grade: (c?.grade ?? "").trim(),
  absence: c?.absence ?? "",
  remarks: (c?.remarks ?? "").trim()
});

export const sameCell = (a: Cell | undefined, b: Cell | undefined) => {
  const x = norm(a);
  const y = norm(b);
  return x.marks === y.marks && x.grade === y.grade && x.absence === y.absence && x.remarks === y.remarks;
};

const isBlank = (c: Cell) => !c.marks.trim() && !c.grade.trim() && !c.absence;

/* Up to 2 decimals, like the API stores them */
const MARKS_RE = /^\d+(\.\d{1,2})?$/;

/* What is wrong with a changed cell, or null. `grades`: the grades the paper's scale allows (null: any) */
export function cellProblem(paper: ExamPaper, cell: Cell, original: Cell | undefined, grades: string[] | null): string | null {
  const c = norm(cell);
  if (isBlank(c)) {
    if (original && !isBlank(norm(original))) return "A saved entry can't be removed: enter it again or mark the student absent";
    if (c.remarks) return "Enter marks (or mark absent) to save a remark";
    return null;
  }
  if (c.absence) return null;
  if (paper.gradingType === "GRADE") {
    if (!c.grade) return `${paper.subject.subjectName} is graded: pick a grade`;
    if (grades && !grades.includes(c.grade)) return `${c.grade} is not a grade on this scale (${grades.join(", ")})`;
    return null;
  }
  if (!c.marks) return "Enter the marks or mark the student absent";
  if (!MARKS_RE.test(c.marks)) return "Marks are a number with at most 2 decimals";
  const n = Number(c.marks);
  if (paper.maxMarks !== null && n > paper.maxMarks) return `Out of ${paper.maxMarks}: ${c.marks} is too high`;
  return null;
}

/* The API entry for a cell (assumes cellProblem returned null and the cell isn't blank) */
export function entryOf(studentId: string, paper: ExamPaper, cell: Cell): MarkEntry {
  const c = norm(cell);
  const entry: MarkEntry = {
    studentId,
    examPaperId: paper.id,
    isAbsent: !!c.absence
  };
  if (c.absence) entry.absenceReason = c.absence;
  else if (paper.gradingType === "GRADE") entry.grade = c.grade;
  else entry.marksObtained = Number(c.marks);
  if (c.remarks) entry.remarks = c.remarks;
  return entry;
}

export const cellFromRecord = (
  m: Pick<MarkRecord, "marksObtained" | "grade" | "gradeIsManual" | "isAbsent" | "absenceReason" | "remarks">,
  paper: ExamPaper
): Cell => ({
  marks: !m.isAbsent && m.marksObtained !== null && m.marksObtained !== undefined ? String(m.marksObtained) : "",
  grade: !m.isAbsent && paper.gradingType === "GRADE" ? (m.grade ?? "") : "",
  absence: m.isAbsent ? (m.absenceReason ?? "ABSENT") : "",
  remarks: m.remarks ?? ""
});
