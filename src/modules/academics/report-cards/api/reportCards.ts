import { api } from "@/common/api";
import type { PolicySettings, ResultPolicy } from "../../exams/api/grading";

/* Results computed live from marks under the result policy, and their published versions
   (backend academics/report-cards and assessment-schemes). An exam and an assessment scheme have
   the same set of endpoints, so the page works on a "source" of either kind. */

export type ResultStatus = "PASS" | "FAIL" | "COMPARTMENT" | "INCOMPLETE";
export const RESULT_LABELS: Record<ResultStatus, string> = { PASS: "Pass", FAIL: "Fail", COMPARTMENT: "Compartment", INCOMPLETE: "Incomplete" };
export const RESULT_TONES = { PASS: "success", FAIL: "danger", COMPARTMENT: "warning", INCOMPLETE: "neutral" } as const;

export type SubjectRef = { id: string; subjectName: string; subjectCode: string };

export type LineStatus = "NOT_RECORDED" | "PRESENT" | "GRADED" | "ABSENT" | "EXEMPT";

export type ComponentLine = {
  paperId: string;
  displayCode: string;
  component: string | null;
  maxMarks: number | null;
  passMarks: number | null;
  status: LineStatus;
  marksObtained: number | null;
  grade?: string | null;
  remarks?: string | null;
  absenceReason?: string;
  graceMarks?: number;
};

/* One subject of a report card; scheme cards add the exams that make it up */
export type SubjectLine = {
  paperId?: string;
  subject: SubjectRef;
  category: "SCHOLASTIC" | "CO_SCHOLASTIC";
  maxMarks?: number | null;
  passMarks?: number | null;
  marksObtained?: number | null;
  graceMarks?: number | null;
  marksAwarded?: number | null;
  percentage?: number | null;
  grade: string | null;
  gradePoint?: number | null;
  remark: string | null;
  teacherRemarks?: string | null;
  status: LineStatus;
  passed?: boolean | null;
  counted: boolean;
  components?: ComponentLine[];
  exams?: { examId: string; examName: string; weight: number; status: string; percentage: number | null; grade: string | null }[];
};

export type Display = {
  marks: boolean;
  percentage: boolean;
  grades: boolean;
  gradePoints: boolean;
  rank: boolean;
  rankToStudents: boolean;
  sectionRank: boolean;
  classRank: boolean;
};

export type Figures = {
  totalObtained: number | null;
  totalMax: number | null;
  graceTotal: number | null;
  percentage: number | null;
  grade: string | null;
  gpa: number | null;
  cgpa?: number | null;
  result: ResultStatus;
  failedSubjects: SubjectRef[];
  compartmentSubjects: SubjectRef[];
  rank: number | null;
  classRank: number | null;
};

export type SheetStudent = Figures & {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  studentCode: string | null;
  enrollmentStatus: "ACTIVE" | "LEFT";
  subjects: SubjectLine[];
  coScholastic: SubjectLine[];
};

export type Statistics = {
  students: number;
  appeared: number;
  passed: number;
  compartment: number;
  failed: number;
  incomplete: number;
  passPercentage: number | null;
  averagePercentage: number | null;
  highestPercentage: number | null;
  averageGpa: number | null;
  subjects: { paperId?: string; subject: SubjectRef; average: number | null; highest: number | null; lowest: number | null; passed: number }[];
};

export type SheetPolicy = ResultPolicy & { source: string; assignmentId: string | null };

export type SheetPaper = {
  id: string;
  displayCode: string;
  subject: SubjectRef;
  component: string | null;
  gradingType: "MARKS" | "GRADE";
  maxMarks: number | null;
  passMarks: number | null;
  examDate: string | null;
};

/* GET /report-cards/sections/:sectionId?examId= and GET /assessment-schemes/:id/results?sectionId= */
export type ResultSheet = {
  exam?: {
    id: string;
    examName: string;
    examType: string | null;
    startDate: string | null;
    endDate: string | null;
    resultsPublishedAt: string | null;
  };
  scheme?: { id: string; name: string; resultsPublishedAt: string | null; exams: { examId: string; examName: string; weight: number; kind?: "BUCKET" }[] };
  section: { id: string; name: string; classId: string };
  policy: SheetPolicy;
  gradeScale: { id: string; name: string } | null;
  display: Display;
  papers?: SheetPaper[];
  students: SheetStudent[];
  classSize: number | null;
  statistics: Statistics;
};

/* One report card body (live, or frozen in a snapshot) */
export type StudentReport = Figures & {
  kind: "EXAM" | "SCHEME";
  exam?: { id: string; examName: string; examType?: string | null; startDate?: string | null; endDate?: string | null };
  scheme?: { id: string; name: string; exams?: { examId: string; examName: string; weight: number; kind?: "BUCKET" }[] };
  policy: SheetPolicy | null;
  gradeScale: { id: string; name: string } | null;
  display: Display;
  subjects: SubjectLine[];
  coScholastic: SubjectLine[];
  sectionSize: number | null;
  classSize: number | null;
  sectionAverage: number | null;
};

export type StudentCard = {
  student: { id: string; rollNumber: string | null; section: { id: string; name: string } };
  academicYearId: string;
  reports?: StudentReport[];
  report?: StudentReport;
};

export type PublicationStatus = "CURRENT" | "SUPERSEDED" | "WITHDRAWN";

export type Publication = {
  id: string;
  kind: "EXAM" | "SCHEME";
  examId: string | null;
  schemeId: string | null;
  version: number;
  publishedAt: string;
  publishedBy: string | null;
  publisher?: { id: string; firstName: string; lastName: string } | null;
  supersededAt: string | null;
  withdrawnAt: string | null;
  reportCount: number;
  changedCount: number | null;
  status: PublicationStatus;
};

export type Integrity = {
  publicationId: string;
  version: number;
  expected: number;
  verified: number;
  intact: boolean;
  tampered: string[];
  missing: string[];
  unexpected: string[];
};

export type ChangeStatus = "UNCHANGED" | "CHANGED" | "NOT_PUBLISHED" | "NO_LONGER_LISTED";

export type Comparison = {
  publication: Publication;
  summary: { students: number; unchanged: number; changed: number; notPublished: number; noLongerListed: number };
  students: {
    studentId: string;
    firstName: string;
    lastName: string;
    section: string;
    status: ChangeStatus;
    changes: { field: string; published: unknown; live: unknown }[];
  }[];
};

export type PreviewFigures = {
  result: ResultStatus | null;
  percentage: number | null;
  grade: string | null;
  gpa: number | null;
  graceTotal: number | null;
  rank: number | null;
  classRank: number | null;
};

export type Preview = {
  policy: ResultPolicy;
  summary: {
    students: number;
    changed: number;
    resultChanged: number;
    current: Record<ResultStatus, number>;
    preview: Record<ResultStatus, number>;
  };
  changes: { studentId: string; firstName: string; lastName: string; section: string; current: PreviewFigures; preview: PreviewFigures }[];
};

export type Snapshot = {
  id: string;
  kind: "EXAM" | "SCHEME";
  sourceId: string;
  sourceName: string;
  version: number;
  sectionId: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string | null;
    studentCode: string | null;
    rollNumber: string | null;
    enrollmentStatus: string;
    section: { id: string; name: string };
  };
  report: StudentReport;
  publishedAt: string;
  integrity: "VERIFIED" | "TAMPERED";
  publicationStatus: PublicationStatus | null;
};

/* ---- the source: an exam or an assessment scheme ---- */

export type SourceKind = "exam" | "scheme";

export type Source = {
  kind: SourceKind;
  id: string;
  name: string;
  publishedAt: string | null;
};

export const SNAPSHOTS_PATH = "/academics/report-cards/snapshots";

export const sourcePaths = ({ kind, id }: Pick<Source, "kind" | "id">) => {
  const publication = kind === "exam" ? `/academics/exams/${id}/result-publication` : `/academics/assessment-schemes/${id}/result-publication`;
  return {
    /* Query keys start with these, so invalidating them refreshes the page */
    sheet: (sectionId: string) =>
      kind === "exam"
        ? { path: `/academics/report-cards/sections/${sectionId}`, query: { examId: id } }
        : { path: `/academics/assessment-schemes/${id}/results`, query: { sectionId } },
    student: (studentId: string) =>
      kind === "exam"
        ? { path: `/academics/report-cards/students/${studentId}`, query: { examId: id } }
        : { path: `/academics/assessment-schemes/${id}/students/${studentId}`, query: {} },
    pdf: (studentId: string) =>
      kind === "exam"
        ? { path: `/academics/report-cards/students/${studentId}/pdf`, query: { examId: id } }
        : { path: `/academics/assessment-schemes/${id}/students/${studentId}/pdf`, query: {} },
    publication,
    versions: `${publication}/versions`,
    integrity: (version: number) => `${publication}/versions/${version}/integrity`,
    comparison: `${publication}/comparison`,
    preview: kind === "exam" ? "/academics/report-cards/previews" : `/academics/assessment-schemes/${id}/previews`,
    snapshotFilter: kind === "exam" ? { examId: id } : { schemeId: id }
  };
};

/* Which permissions each action needs, per kind of source */
export const sourcePerms = (kind: SourceKind, can: (key: string) => boolean) =>
  kind === "exam"
    ? {
        sheet: can("academics.reportCards.read"),
        versions: can("academics.resultPublications.read"),
        publish: can("academics.resultPublications.publish"),
        preview: can("academics.reportCards.preview"),
        snapshots: can("academics.reportCards.read")
      }
    : {
        sheet: can("academics.assessmentSchemes.read"),
        versions: can("academics.assessmentSchemes.read"),
        publish: can("academics.assessmentSchemes.publish"),
        preview: can("academics.assessmentSchemes.preview"),
        snapshots: can("academics.reportCards.read")
      };

export const publish = (s: Source) => api.post<unknown>(sourcePaths(s).publication);
export const publishVersion = (s: Source) => api.post<Publication>(sourcePaths(s).versions);
export const withdraw = (s: Source) => api.delete<unknown>(sourcePaths(s).publication);
export const checkIntegrity = (s: Source, version: number) => api.get<Integrity>(sourcePaths(s).integrity(version));

export type PreviewBody = { sectionId?: string; policyId?: string; policy?: Partial<PolicySettings> & { name?: string } };
export const runPreview = (s: Source, body: PreviewBody) =>
  api.post<Preview>(sourcePaths(s).preview, s.kind === "exam" ? { examId: s.id, ...body } : body);

export const downloadPdf = (s: Source, studentId: string) => {
  const { path, query } = sourcePaths(s).pdf(studentId);
  return api.download(path, query, "report-card.pdf");
};
export const downloadSnapshotPdf = (snapshotId: string) => api.download(`${SNAPSHOTS_PATH}/${snapshotId}/pdf`, undefined, "report-card.pdf");

/* Every key of the policy settings (an inline preview sends a full copy of the policy in force) */
export const POLICY_SETTING_KEYS: (keyof PolicySettings)[] = [
  "gradingMode",
  "gradeScaleId",
  "coScholasticScaleId",
  "gpaScale",
  "usePaperPassMarks",
  "subjectMinPercent",
  "requirePassingGrade",
  "requireComponentPass",
  "overallMinPercent",
  "maxCompartmentSubjects",
  "graceMaxPerSubject",
  "graceMaxTotal",
  "graceCountsInTotal",
  "bestOfSubjects",
  "absentTreatment",
  "medicalTreatment",
  "exemptTreatment",
  "rankingMethod",
  "rankScope",
  "rankFailedStudents",
  "showRankToStudents",
  "percentageDecimals",
  "gpaDecimals",
  "roundingMode",
  "subjects"
];

/* "56", "56.5" -> "56.5%"; null -> "" */
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "" : `${n}%`);
export const studentFullName = (s: { firstName?: string | null; lastName?: string | null }) => [s.firstName, s.lastName].filter(Boolean).join(" ");

const LINE_LABELS: Partial<Record<LineStatus, string>> = { NOT_RECORDED: "Not entered", ABSENT: "Absent", EXEMPT: "Exempt" };

/* "Passed", "Absent"… for a subject line */
export const lineStatusLabel = (line: SubjectLine) =>
  LINE_LABELS[line.status] ?? (line.passed === false ? "Failed" : line.passed === true ? "Passed" : line.counted === false ? "Not counted" : "");
