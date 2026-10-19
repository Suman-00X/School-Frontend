import { api } from "@/common/api";

/* Who teaches a subject in a section, in one year (the header's year). No edit: remove and add again. */
export type TeacherAssignment = {
  id: string;
  academicYearId: string;
  teacherId: string;
  sectionId: string;
  subjectId: string;
  description: string | null;
  teacher: { id: string; employeeCode: string; user: { firstName: string; lastName: string } };
  section: { id: string; sectionName: string };
  subject: { id: string; subjectName: string; subjectCode: string };
};

export type TeacherAssignmentInput = { teacherId: string; sectionId: string; subjectId: string; description?: string };

export const TEACHER_ASSIGNMENTS_PATH = "/academics/teacher-assignments";

export const assignTeacher = (body: TeacherAssignmentInput) => api.post<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH, body);

export const removeAssignment = (id: string) => api.delete<TeacherAssignment>(`${TEACHER_ASSIGNMENTS_PATH}/${id}`);

/* "Change teacher": the API has no edit, so remove the old assignment, then add the new one.
   If the add fails the old one is put back. */
export async function changeTeacher({ assignment, teacherId }: { assignment: TeacherAssignment; teacherId: string }) {
  await removeAssignment(assignment.id);
  const body = { sectionId: assignment.sectionId, subjectId: assignment.subjectId, ...(assignment.description ? { description: assignment.description } : {}) };
  try {
    return await assignTeacher({ ...body, teacherId });
  } catch (err) {
    await assignTeacher({ ...body, teacherId: assignment.teacherId }).catch(() => undefined);
    throw err;
  }
}

export const teacherName = (t: TeacherAssignment["teacher"]) => `${t.user.firstName} ${t.user.lastName}`.trim();

/* Lessons a week from the teacher's timetable (GET /academics/timetable/teachers/:teacherId) */
export type TeacherTimetableSummary = { teacherId: string; academicYearId: string; weeklyLessons: number };
