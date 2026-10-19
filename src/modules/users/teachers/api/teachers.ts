import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* The account summary every profile embeds */
export type UserSummary = { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string };

export type Teacher = {
  id: string;
  userId: string;
  employeeCode: string;
  qualification: string | null;
  experienceYears: number | null;
  joiningDate: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | null;
  bloodGroup: string | null;
  description: string | null;
  createdAt: string;
  user: UserSummary;
};

export type TeacherProfileBody = Record<string, string | number>;

export const useTeacher = (teacherId: string | undefined) => useApiGet<Teacher>(teacherId ? `/users/teachers/${teacherId}` : null);

/* employeeCode is generated */
export const createTeacher = (body: { user: Record<string, unknown>; profile: TeacherProfileBody }) => api.post<Teacher>("/users/teachers", body);

export const updateTeacher = (teacherId: string, body: TeacherProfileBody) => api.patch<Teacher>(`/users/teachers/${teacherId}`, body);

/* ---- teaching (academics module, year-scoped by the header's year) ---- */

export type TeacherAssignment = {
  id: string;
  sectionId: string;
  subjectId: string;
  description: string | null;
  section: { id: string; sectionName: string };
  subject: { id: string; subjectName: string; subjectCode: string };
};

/* Only for labelling sections with their class and spotting class-teacher duties */
export type SectionRef = {
  id: string;
  sectionName: string;
  classTeacherId: string | null;
  deputyClassTeacherId: string | null;
  class?: { id: string; className: string } | null;
};

export type TimetableSlot = {
  id: string;
  period: { id: string; periodNumber: number; name: string; startTime: string; endTime: string };
  subject: { id: string; subjectName: string; subjectCode: string } | null;
  section: { id: string; name: string } | null;
  room: string | null;
};

export type TeacherTimetable = {
  teacherId: string;
  weeklyLessons: number;
  periods: { id: string; periodNumber: number; name: string; startTime: string; endTime: string; isBreak: boolean }[];
  days: { weekday: number; name: string; slots: TimetableSlot[] }[];
};
