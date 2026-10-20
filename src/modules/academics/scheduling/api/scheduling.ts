import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { GridDay, GridPeriod, GridSlot } from "../../timetable/api/timetable";

/* Generated timetables (backend academics/scheduling). Generating makes a draft run and never
   changes the real timetable; applying a draft writes it (class lessons, or the exam's papers). */

export type RunKind = "CLASS_TIMETABLE" | "EXAM_TIMETABLE";
export type RunStatus = "DRAFT" | "APPLIED" | "DISCARDED";
/* AGENT_TOOL: an AI agent asked for the run through its tools */
export type RunOrigin = "API" | "AGENT_TOOL";
export type ClassMode = "FILL" | "REPLACE";
export type ExamAlign = "CLASS" | "SCHOOL" | "NONE";
export type ExamSpread = "EVEN" | "COMPACT";

export type Issue = {
  severity: "ERROR" | "WARNING";
  code: string;
  /* Written for people: shown as is */
  message: string;
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
};

/* ---------- class timetable ---------- */

/* ISO weekday: 1 = Monday … 7 = Sunday; periodNumbers left out = the whole day */
export type Unavailable = { weekday: number; periodNumbers?: number[] };

export type SubjectRule = {
  subjectId: string;
  classIds?: string[];
  sectionIds?: string[];
  /* How many of the weekly classes are doubles (two periods in a row) */
  doublePeriods?: number;
  maxPerDay?: number;
  /* Period numbers of the bell schedule */
  preferredPeriods?: number[];
  avoidPeriods?: number[];
  /* A shared room (a lab): never two classes in it at once */
  room?: string;
};

export type TeacherRule = { teacherId: string; unavailable?: Unavailable[]; maxPerDay?: number; maxConsecutive?: number };
export type ClosedPeriod = { weekday: number; periodNumbers?: number[]; classIds?: string[]; sectionIds?: string[] };
export type PinnedClass = { sectionId: string; weekday: number; periodNumber: number; subjectId: string };
export type Weights = Partial<Record<WeightKey, number>>;
export type WeightKey = "spread" | "adjacency" | "holes" | "balance" | "teacherGaps" | "preferences";

export type ClassRequest = {
  /* Default: every section of the year */
  sectionIds?: string[];
  mode: ClassMode;
  subjects?: SubjectRule[];
  teachers?: TeacherRule[];
  closedPeriods?: ClosedPeriod[];
  pinned?: PinnedClass[];
  teacherMaxPerDay?: number;
  teacherMaxConsecutive?: number;
  weights?: Weights;
  /* Same seed and inputs give the same timetable; leave out for a new one */
  seed?: number;
  attempts?: number;
  timeLimitMs?: number;
};

/* GET …/class-timetable/inputs: what a timetable would be made from, before generating */
export type ClassInputs = {
  academicYearId: string;
  mode: ClassMode;
  week: {
    days: { weekday: number; name: string }[];
    periods: GridPeriod[];
    teachingPeriodsPerWeek: number;
  };
  sections: {
    id: string;
    name: string;
    classId: string;
    periodsNeeded: number;
    periodsAvailable: number;
    subjects: {
      subjectId: string;
      subjectName: string | null;
      weeklyClasses: number | null;
      toPlace: number;
      doubles: number;
      teacherId: string | null;
      teacherName: string | null;
    }[];
  }[];
  teachers: { teacherId: string; name: string | null; periodsPerWeek: number; periodsAvailable: number }[];
  issues: Issue[];
};

export type ClassUnplaced = {
  sectionId: string;
  subjectId: string;
  teacherId: string | null;
  message: string;
  sectionName: string | null;
  subjectName: string | null;
  teacherName: string | null;
  missingPeriods: number;
  /* cells: how many periods of the week failed for this reason */
  reasons: { code: string; cells: number; text: string }[];
};

export type ClassReport = {
  issues: Issue[];
  unplaced: ClassUnplaced[];
  score: { complete: boolean; cost: number; breakdown: Record<string, number>; placedPeriods: number; requiredPeriods: number };
  stats: { seed: number; attempts: number; elapsedMs: number } & Record<string, unknown>;
  changes: { add: number; remove: number; keep: number };
};

export type ClassResult = {
  placements: { sectionId: string; subjectId: string; teacherId: string; weekday: number; periodId: string; room: string | null; pinned?: boolean }[];
  sectionIds: string[];
  removeSlotIds: string[];
  keepSlotIds: string[];
};

/* ---------- exam timetable ---------- */

export type Sitting = { name: string; startTime: string; endTime: string };

export type ExamRequest = {
  examId: string;
  /* Default: the exam's dates (required when the exam has none) */
  startDate?: string;
  endDate?: string;
  sessions?: Sitting[];
  maxPapersPerDay?: number;
  minGapDays?: number;
  align?: ExamAlign;
  spread?: ExamSpread;
  durations?: { subjectId?: string; component?: string; classIds?: string[]; minutes: number }[];
  restDayBefore?: string[];
  avoidDates?: string[];
  keepScheduled?: boolean;
  seed?: number;
};

export type ExamUnplaced = {
  message: string;
  subjectName: string;
  sectionNames: string[];
  paperIds: string[];
  reasons: { code: string; sittings: number; text: string }[];
};

export type ExamReport = {
  issues: Issue[];
  unplaced: ExamUnplaced[];
  score: { complete: boolean; placedPapers: number; requiredPapers: number; firstDate: string | null; lastDate: string | null; breakdown: Record<string, number> };
  stats: { seed: number; attempts: number; elapsedMs: number } & Record<string, unknown>;
  changes: { schedule: number; keep: number };
  window?: { startDate: string; endDate: string; schoolDays: number; closedDays: number };
};

/* One paper's place; kept: it already had this date and time (keepScheduled) */
export type ExamRow = { paperId: string; examDate: string; startTime: string; endTime: string; session?: string; kept?: boolean };

/* ---------- runs ---------- */

type RunBase = {
  id: string;
  status: RunStatus;
  origin: RunOrigin;
  academicYearId: string;
  examId: string | null;
  seed: number;
  /* "3 sections · 51 of 51 periods placed" */
  summary: string;
  createdAt: string;
  appliedAt: string | null;
  discardedAt: string | null;
};

/* The list leaves result out; GET /runs/:runId has it */
export type ClassRun = RunBase & { kind: "CLASS_TIMETABLE"; request: ClassRequest; report: ClassReport; result?: ClassResult };
export type ExamRun = RunBase & { kind: "EXAM_TIMETABLE"; request: ExamRequest; report: ExamReport; result?: { rows: ExamRow[] } };
export type Run = ClassRun | ExamRun;

/* A lesson of a draft grid: NEW (the draft adds it, id null), KEPT (stays), PINNED, OTHER (a section the draft doesn't plan) */
export type DraftSlotStatus = "NEW" | "KEPT" | "PINNED" | "OTHER";
export type DraftSlot = Omit<GridSlot, "id"> & { id: string | null; status: DraftSlotStatus };
export type DraftGrid = { periods: GridPeriod[]; days: (Omit<GridDay, "slots"> & { slots: DraftSlot[] })[]; runId: string; runStatus: RunStatus };
export type DraftSectionGrid = DraftGrid & { section: { id: string; name: string } };
export type DraftTeacherGrid = DraftGrid & { teacherId: string; weeklyLessons: number };

export type ClassApplied = { run: ClassRun; added: number; removed: number; kept: number };
export type ExamApplied = { run: ExamRun; scheduled: number };

export const SCHEDULING_PATH = "/academics/scheduling";
export const CLASS_INPUTS_PATH = `${SCHEDULING_PATH}/class-timetable/inputs`;
export const RUNS_PATH = `${SCHEDULING_PATH}/runs`;
export const runPath = (runId: string) => `${RUNS_PATH}/${runId}`;
export const draftSectionPath = (runId: string, sectionId: string) => `${runPath(runId)}/sections/${sectionId}`;
export const draftTeacherPath = (runId: string, teacherId: string) => `${runPath(runId)}/teachers/${teacherId}`;

/* The generator page (AC-07b), under Setup › Timetables */
export const GENERATE_TIMETABLE_PATH = "/academics/timetable/generate";

/* The year comes from the header (X-Academic-Year-Id) */
export const generateClassTimetable = (body: ClassRequest) => api.post<ClassRun>(`${SCHEDULING_PATH}/class-timetable/runs`, body);
/* The exam's own year */
export const generateExamTimetable = (body: ExamRequest) => api.post<ExamRun>(`${SCHEDULING_PATH}/exam-timetable/runs`, body);
/* 409 when the timetable or papers changed since the draft; 422 when incomplete without allowIncomplete */
export const applyRun = ({ runId, allowIncomplete }: { runId: string; allowIncomplete?: boolean }) =>
  api.post<ClassApplied | ExamApplied>(`${runPath(runId)}/apply`, allowIncomplete ? { allowIncomplete } : {});
export const discardRun = (runId: string) => api.post<null>(`${runPath(runId)}/discard`);

/* Runs of the header's year, newest first (no result) */
export function useRuns(query: { kind: RunKind; status?: RunStatus; examId?: string; limit?: number }, opts: { enabled?: boolean; academicYearId?: string } = {}) {
  const { can } = useAuth();
  return useQuery({
    queryKey: [RUNS_PATH, { ...query, academicYearId: opts.academicYearId ?? "" }],
    enabled: (opts.enabled ?? true) && can("academics.scheduling.read"),
    queryFn: async () =>
      (await api.get<Run[]>(RUNS_PATH, { page: 1, limit: 10, ...query }, opts.academicYearId ? { academicYearId: opts.academicYearId } : undefined)).data
  });
}

/* A request as sent again for "Try another": same rules, a new seed */
export const withoutSeed = <T extends { seed?: number }>(request: T): T => {
  const rest = { ...request };
  delete rest.seed;
  return rest;
};

/* "Monday" for an ISO weekday */
export const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = { DRAFT: "Draft", APPLIED: "Applied", DISCARDED: "Discarded" };
