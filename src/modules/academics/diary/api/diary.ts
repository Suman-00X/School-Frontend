import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import type { Tone } from "@/common/ui";

/* /academics/diary (header's year): a section's daily diary, and the portal's
   /me/students/:id/diary. Dates are "YYYY-MM-DD". */
export type DiaryKind = "CLASSWORK" | "HOMEWORK" | "REMINDER" | "NOTE";

export type DiaryPerson = { id: string; firstName: string; lastName: string; role: string };

export type DiaryEntry = {
  id: string;
  academicYearId: string;
  sectionId: string;
  entryDate: string;
  kind: DiaryKind;
  subjectId: string | null;
  subject: { id: string; subjectName: string; subjectCode: string } | null;
  /* A note to this student's family only */
  studentId: string | null;
  student: { id: string; admissionNumber: string; user: { firstName: string; lastName: string } } | null;
  body: string;
  writtenBy: string;
  writer: DiaryPerson | null;
  /* Staff API only: the author, the principal or an admin */
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
};

/* Online homework set that day (academics/homework) */
export type DiaryHomework = { id: string; title: string; dueDate: string; subject: { id: string; subjectName: string } | null };

export type DiarySignature = {
  id: string;
  studentId: string;
  entryDate: string;
  signedAt: string;
  signer: DiaryPerson | null;
  parentNote: string | null;
};

export type SectionDiaryDay = {
  date: string;
  sectionId: string;
  entries: DiaryEntry[];
  homework: DiaryHomework[];
  signatures: { students: number; signed: number; notes: number };
};

export type SignatureRow = {
  studentId: string;
  rollNumber: string;
  admissionNumber: string | null;
  firstName: string;
  lastName: string;
  signature: DiarySignature | null;
  changedSinceSigned: boolean;
};

export type SectionDiarySummary = { date: string; entries: number; signed: number };

export type EntryInput = { sectionId: string; entryDate: string; kind: DiaryKind; subjectId?: string; studentId?: string; body: string };
export type EntryPatch = { id: string; kind?: DiaryKind; subjectId?: string | null; body?: string };

export const DIARY_PATH = "/academics/diary";
const sectionPath = (sectionId: string) => `${DIARY_PATH}/sections/${sectionId}`;

export const DIARY_KINDS: { value: DiaryKind; label: string; tone: Tone; description: string }[] = [
  { value: "CLASSWORK", label: "Classwork", tone: "info", description: "What was done in class" },
  { value: "HOMEWORK", label: "Homework", tone: "primary", description: "What to do at home" },
  { value: "REMINDER", label: "Reminder", tone: "warning", description: "Something to bring or remember" },
  { value: "NOTE", label: "Note", tone: "neutral", description: "A message to the families, or to one family" }
];
export const DIARY_KIND_OF = Object.fromEntries(DIARY_KINDS.map(k => [k.value, k])) as Record<DiaryKind, (typeof DIARY_KINDS)[number]>;
export const SUBJECT_KINDS: DiaryKind[] = ["CLASSWORK", "HOMEWORK"];

export const useSectionDiaryDay = (sectionId: string, date: string) =>
  useApiGet<SectionDiaryDay>(sectionId && date ? `${sectionPath(sectionId)}/day` : null, { date });
export const useDiarySignatures = (sectionId: string, date: string) =>
  useApiGet<SignatureRow[]>(sectionId && date ? `${sectionPath(sectionId)}/signatures` : null, { date });
export const useSectionDiaryDays = (sectionId: string, from: string, to: string) =>
  useApiGet<SectionDiarySummary[]>(sectionId ? `${sectionPath(sectionId)}/days` : null, { from, to });

export const createEntry = (body: EntryInput) => api.post<DiaryEntry>(`${DIARY_PATH}/entries`, body);
export const updateEntry = ({ id, ...body }: EntryPatch) => api.patch<DiaryEntry>(`${DIARY_PATH}/entries/${id}`, body);
export const deleteEntry = (id: string) => api.delete<null>(`${DIARY_PATH}/entries/${id}`);

/* Date arithmetic on "YYYY-MM-DD" (UTC, so no time-zone drift) */
export const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/* Monday of the date's week */
export const weekStart = (date: string) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const dayLabel = (date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
