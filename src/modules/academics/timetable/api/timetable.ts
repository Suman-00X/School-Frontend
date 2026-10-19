import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { fetchAll } from "../../shared/api/fetchAll";

/* The bell schedule of an academic year (GET /academics/periods, header's year) */
export type Period = {
  id: string;
  academicYearId: string;
  periodNumber: number;
  name: string;
  /* "08:30:00" */
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

export type PeriodInput = {
  periodNumber: number;
  name: string;
  /* "08:30" */
  startTime: string;
  endTime: string;
  isBreak?: boolean;
};

/* One lesson of a weekly grid */
export type GridSlot = {
  id: string;
  period: { id: string; periodNumber: number; name: string; startTime: string; endTime: string };
  subject: { id: string; subjectName: string; subjectCode?: string } | null;
  teacher: { id: string; name: string } | null;
  /* "Class 6-A" */
  section: { id: string; name: string } | null;
  room: string | null;
};

export type GridDay = { weekday: number; name: string; slots: GridSlot[] };
export type GridPeriod = { id: string; periodNumber: number; name: string; startTime: string; endTime: string; isBreak: boolean };

/* The weekly grid shared by the section, teacher and "my week" views (weekly off days left out) */
export type TimetableGridData = { periods: GridPeriod[]; days: GridDay[] };

export type SectionTimetable = TimetableGridData & { section: { id: string; name: string }; academicYearId: string };
export type TeacherTimetable = TimetableGridData & { teacherId: string; academicYearId: string; weeklyLessons: number };

/* ISO weekday: 1 = Monday … 7 = Sunday */
export type SlotInput = {
  sectionId: string;
  weekday: number;
  periodId: string;
  subjectId: string;
  /* Default: the teacher assigned to the subject in the section */
  teacherId?: string;
  room?: string;
};

export const PERIODS_PATH = "/academics/periods";
export const SLOTS_PATH = "/academics/timetable/slots";
export const sectionGridPath = (sectionId: string) => `/academics/timetable/sections/${sectionId}`;
export const teacherGridPath = (teacherId: string) => `/academics/timetable/teachers/${teacherId}`;
export const MY_TIMETABLE_PATH = "/me/teaching/timetable";

export const createPeriod = (body: PeriodInput) => api.post<Period>(PERIODS_PATH, body);
export const updatePeriod = ({ id, ...body }: Partial<PeriodInput> & { id: string }) => api.patch<Period>(`${PERIODS_PATH}/${id}`, body);
export const deletePeriod = (id: string) => api.delete<Period>(`${PERIODS_PATH}/${id}`);

export const createSlot = (body: SlotInput) => api.post<unknown>(SLOTS_PATH, body);
export const updateSlot = ({ id, ...body }: Partial<Omit<SlotInput, "sectionId">> & { id: string }) => api.patch<unknown>(`${SLOTS_PATH}/${id}`, body);
export const deleteSlot = (id: string) => api.delete<unknown>(`${SLOTS_PATH}/${id}`);

/* Every write here can change any grid: refresh them all */
export const TIMETABLE_INVALIDATE = ["/academics/timetable", "/academics/periods", "/me/teaching/timetable"];

/* "08:30:00" → "08:30" */
export const hhmm = (time: string | null | undefined) => (time ? time.slice(0, 5) : "");

/* GET /academics/section-subjects?sectionId=: the subjects taught in a section */
export type SectionSubject = { id: string; sectionId: string; subjectId: string; subject: { id: string; subjectName: string; subjectCode: string } };

export function useSectionSubjects(sectionId: string | null | undefined) {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/academics/section-subjects", { sectionId, all: true }],
    enabled: !!sectionId && can("academics.sectionSubjects.read"),
    staleTime: 60_000,
    queryFn: async () =>
      (await fetchAll<SectionSubject>("/academics/section-subjects", { sectionId: sectionId! })).sort((a, b) =>
        a.subject.subjectName.localeCompare(b.subject.subjectName)
      )
  });
}

/* GET /academics/teacher-assignments?sectionId=: who teaches each subject in a section (names embedded) */
export type SectionAssignment = {
  id: string;
  teacherId: string;
  subjectId: string;
  teacher: { id: string; employeeCode: string; user: { firstName: string; lastName: string } } | null;
};

export function useSectionAssignments(sectionId: string | null | undefined) {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/academics/teacher-assignments", { sectionId, all: true }],
    enabled: !!sectionId && can("academics.teacherAssignments.read"),
    staleTime: 60_000,
    queryFn: async () => fetchAll<SectionAssignment>("/academics/teacher-assignments", { sectionId: sectionId! })
  });
}
