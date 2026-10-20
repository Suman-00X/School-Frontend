import type { RouteObject } from "react-router-dom";
import { routes as academicYearRoutes } from "./academic-years";
import { routes as classRoutes } from "./classes";
import { routes as subjectRoutes } from "./subjects";
import { routes as curriculumRoutes } from "./class-subjects";
import { routes as teacherAssignmentRoutes } from "./teacher-assignments";
import { routes as calendarRoutes } from "./calendar";
import { routes as attendancePolicyRoutes } from "./attendance-policy";
import { routes as examEligibilityRoutes } from "./exam-eligibility";
import { routes as subjectCodeRoutes } from "./subject-codes";
import { routes as gradingRoutes } from "./grading";
import { routes as nepPolicyRoutes } from "./nep-policy";
import { routes as enrollmentRoutes } from "./enrollments";
import { setupArea } from "./shared/components/SetupLayout";
import { routes as timetableRoutes } from "./timetable";
import { routes as attendanceRoutes } from "./attendance";
import { routes as homeworkRoutes } from "./homework";
import { routes as behaviourRoutes } from "./behaviour";
import { routes as diaryRoutes } from "./diary";
import { routes as certificateRoutes } from "./certificates";
import { areaRoutes as examAreaRoutes, routes as examRoutes, resultsArea } from "./exams";
import { areaRoutes as marksAreaRoutes } from "./marks";
import { areaRoutes as resultsAreaRoutes } from "./report-cards";
import { areaRoutes as assessmentAreaRoutes, routes as assessmentRoutes } from "./assessments";
import { routes as activityRoutes } from "./activity";

/* Setup pages share the Setup side list (setupArea); the other areas are header tabs of their own */
export const routes: RouteObject[] = [setupArea([...academicYearRoutes, ...classRoutes, ...subjectRoutes, ...curriculumRoutes, ...teacherAssignmentRoutes, ...timetableRoutes, ...calendarRoutes, ...gradingRoutes, ...attendancePolicyRoutes, ...examEligibilityRoutes, ...subjectCodeRoutes, ...nepPolicyRoutes]), ...enrollmentRoutes, ...attendanceRoutes, ...homeworkRoutes, ...diaryRoutes, ...behaviourRoutes, ...certificateRoutes, resultsArea([...examAreaRoutes, ...marksAreaRoutes, ...assessmentAreaRoutes, ...resultsAreaRoutes]), ...examRoutes, ...assessmentRoutes, ...activityRoutes];

/* For other modules: pick and name a section of the header's year, list teachers */
export { SectionSelect, useSectionOptions, sectionTitle } from "./shared/components/SectionSelect";
export { useTeacherOptions, type Section } from "./classes/api/sections";

/* The weekly timetable grid (read-only without onCellClick), e.g. for PO-10 "my timetable" */
export { TimetableGrid, MY_TIMETABLE_PATH, type TeacherTimetable, type TimetableGridData } from "./timetable";

/* The school calendar's data, for the portal's calendar (PO-09; the month grid is MonthCalendar in common/ui) */
export { useEventsBetween, useWorkingDays, eventTone, eventTypeLabel, EVENT_TYPES, closedReason, type CalendarEvent } from "./calendar";

/* Substitution planning (AC-12): the home page's highlight and its overlay, and a teacher's duties */
export { SubstitutionHighlight, SubstitutionOverlay, MyDutiesCard } from "./substitutions";
/* Low attendance (D-85): the teacher's home highlight */
export { LowAttendanceHighlight } from "./attendance";

/* Behaviour log books (AC-18): the student profile's tab and the portal's page (PO-12) */
export { StudentBehaviourTab, BehaviourLog, BehaviourKpis, NoRemarks, type BehaviourRemark, type BehaviourSummary } from "./behaviour";
/* Certificates (AC-19): the portal's page (PO-13) reuses the viewer */
export { CertificatePreview, openPdf, TYPE_ORDER as CERTIFICATE_TYPE_ORDER, TYPE_SHORT as CERTIFICATE_TYPE_SHORT, type CertificateType } from "./certificates";
/* Student leave (AC-09c): the portal's page (PO-14) applies and lists it */
export { LEAVE_REASONS, ON_LEAVE_PATH, STUDENT_LEAVES_PATH, leaveDates, leaveDays, reasonLabel, type StudentLeave, type StudentLeaveSession } from "./student-leaves";
/* Daily diary (AC-20): the portal's page (PO-15) reuses the day view */
export { DiaryLines, DateNav, NoLines, dayLabel as diaryDayLabel, shiftDate, type DiaryEntry, type DiaryHomework, type DiarySignature } from "./diary";
