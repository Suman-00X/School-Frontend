/* Academics › Setup: the pages listed in its side navigation */
export const SETUP_PATHS = {
  /* School structure */
  academicYears: "/academics/academic-years",
  classes: "/academics/classes",
  subjects: "/academics/subjects",
  /* Curriculum: subjects and teachers section by section (?class=&section=), or a teacher's (?tab=teacher&teacher=) */
  curriculum: "/academics/curriculum",
  /* Calendar */
  periods: "/academics/periods",
  timetable: "/academics/timetable",
  calendar: "/academics/calendar",
  /* Policy */
  rollNumbers: "/academics/roll-numbers",
  attendancePolicy: "/academics/attendance/policy",
  examEligibility: "/academics/exam-eligibility",
  grading: "/academics/grading",
  subjectCodes: "/academics/subject-codes",
  nepPolicy: "/academics/nep-policy"
} as const;

export const ENROLLMENTS_PAGE = "/academics/enrollments";
export const PROMOTION_PAGE = "/academics/enrollments/promotion";
