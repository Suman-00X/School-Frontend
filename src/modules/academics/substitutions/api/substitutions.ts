import { api } from "@/common/api";

/* Substitution planning (/academics/substitutions, D-79): an absent teacher's lessons on a date,
   each covered by a substitute, an activity, or left as leisure. ADMIN plans; PRINCIPAL reads. */

export type SubstitutionKind = "SUBSTITUTE" | "ACTIVITY" | "LEISURE" | "NOT_NEEDED";
/* NEEDED: not planned yet. Unplanned once the period is over: LEISURE with plan null. */
export type CoverStatus = "NEEDED" | SubstitutionKind;

type Ref = { id: string; name: string };
type PeriodRef = { id: string; periodNumber: number; name: string; startTime: string; endTime: string };
type SubjectRef = { id: string; subjectName: string };

export type CoverPlan = {
  id: string;
  kind: SubstitutionKind;
  substitute: Ref | null;
  /* SUBSTITUTE: the subject they take when it is not the lesson's */
  subject: SubjectRef | null;
  activity: string | null;
  note: string | null;
  assignedBy: string;
  updatedAt: string;
};

export type CoverItem = {
  timetableSlotId: string;
  period: PeriodRef;
  section: Ref;
  subject: SubjectRef;
  room: string | null;
  absentTeacher: Ref;
  ended: boolean;
  status: CoverStatus;
  plan: CoverPlan | null;
};

export type AbsentTeacher = {
  teacher: Ref & { employeeCode: string };
  status: "ABSENT" | "LEAVE" | "HALF_DAY";
  checkIn: string | null;
  checkOut: string | null;
  remarks: string | null;
  onLeave: boolean;
  periods: CoverItem[];
};

/* A stored plan with its lesson (a teacher's duty, or a plan no longer needed) */
export type Duty = CoverPlan & {
  date: string;
  timetableSlotId: string;
  section: Ref;
  period: PeriodRef;
  lessonSubject: SubjectRef | null;
  absentTeacher: Ref;
};

export type CoverCounts = { periods: number; needed: number; substitute: number; activity: number; leisure: number; notNeeded: number };

export type DayPlan = {
  date: string;
  today: string;
  workingDay: boolean;
  closure: string | null;
  editable: boolean;
  counts: CoverCounts;
  absentTeachers: AbsentTeacher[];
  noLongerNeeded: Duty[];
};

type Brief = { date: string; needed: number; periods: number; absentTeachers: number };
export type CoverSummary = Brief & { workingDay: boolean; next: Brief | null };

export type Candidate = {
  teacherId: string;
  name: string;
  employeeCode: string;
  available: boolean;
  unavailableReason: string | null;
  teachesSection: boolean;
  teachesSubject: boolean;
  lessonsThatDay: number;
  coversThatDay: number;
  current: boolean;
};
export type Candidates = { date: string; timetableSlotId: string; lesson: CoverItem; teachers: Candidate[]; subjects: SubjectRef[] };

export type AssignInput = {
  date: string;
  timetableSlotId: string;
  kind: SubstitutionKind;
  substituteTeacherId?: string;
  subjectId?: string;
  activity?: string;
  note?: string;
};

export const SUBSTITUTIONS_PATH = "/academics/substitutions";
export const SUMMARY_PATH = `${SUBSTITUTIONS_PATH}/summary`;
export const CANDIDATES_PATH = `${SUBSTITUTIONS_PATH}/candidates`;
export const MY_DUTIES_PATH = `${SUBSTITUTIONS_PATH}/mine`;
/* A plan changes the day's plan, the home count, and attendance's cover and missing registers */
export const SUBSTITUTIONS_INVALIDATE = [SUBSTITUTIONS_PATH, "/academics/attendance"];

export const assignCover = (body: AssignInput) => api.put<CoverItem>(SUBSTITUTIONS_PATH, body);
export const cancelCover = (id: string) => api.delete<Duty>(`${SUBSTITUTIONS_PATH}/${id}`);

/* Extra and co-curricular activities offered for a period; any other can be typed */
export const ACTIVITY_SUGGESTIONS = [
  "Library",
  "Games / PE",
  "Art & craft",
  "Music",
  "Dance",
  "Yoga",
  "Quiz",
  "Story telling",
  "Debate",
  "Computer lab",
  "Study period",
  "Moral science"
];
