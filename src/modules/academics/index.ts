import type { RouteObject } from "react-router-dom";
import { routes as academicYearRoutes } from "./academic-years";
import { routes as classRoutes } from "./classes";
import { routes as subjectRoutes } from "./subjects";
import { routes as teacherAssignmentRoutes } from "./teacher-assignments";
import { routes as calendarRoutes } from "./calendar";
import { routes as attendancePolicyRoutes } from "./attendance-policy";
import { routes as gradingRoutes } from "./grading";
import { routes as enrollmentRoutes } from "./enrollments";
import { setupArea } from "./shared/components/SetupLayout";
import { routes as timetableRoutes } from "./timetable";
import { routes as attendanceRoutes } from "./attendance";
import { routes as homeworkRoutes } from "./homework";
import { areaRoutes as examAreaRoutes, routes as examRoutes, resultsArea } from "./exams";
import { areaRoutes as marksAreaRoutes } from "./marks";
import { areaRoutes as resultsAreaRoutes } from "./report-cards";
import { areaRoutes as assessmentAreaRoutes, routes as assessmentRoutes } from "./assessments";
import { routes as activityRoutes } from "./activity";

/* Setup pages share the Setup side list (setupArea); the other areas are header tabs of their own */
export const routes: RouteObject[] = [setupArea([...academicYearRoutes, ...classRoutes, ...subjectRoutes, ...teacherAssignmentRoutes, ...calendarRoutes, ...gradingRoutes, ...attendancePolicyRoutes]), ...enrollmentRoutes, ...timetableRoutes, ...attendanceRoutes, ...homeworkRoutes, resultsArea([...examAreaRoutes, ...marksAreaRoutes, ...resultsAreaRoutes]), ...examRoutes, ...activityRoutes];

/* For other modules: pick and name a section of the header's year, list teachers */
export { SectionSelect, useSectionOptions, sectionTitle } from "./shared/components/SectionSelect";
export { useTeacherOptions, type Section } from "./classes/api/sections";

/* The weekly timetable grid (read-only without onCellClick), e.g. for PO-10 "my timetable" */
export { TimetableGrid, MY_TIMETABLE_PATH, type TeacherTimetable, type TimetableGridData } from "./timetable";

/* The school calendar's data, for the portal's calendar (PO-09; the month grid is MonthCalendar in common/ui) */
export { useEventsBetween, useWorkingDays, eventTone, eventTypeLabel, EVENT_TYPES, closedReason, type CalendarEvent } from "./calendar";
