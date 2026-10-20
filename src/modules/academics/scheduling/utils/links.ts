import type { Issue } from "../api/scheduling";

/* Setup pages a problem is fixed on (kept here: this submodule doesn't edit the shared paths) */
const CURRICULUM = "/academics/curriculum";
export const PERIODS_PAGE = "/academics/periods";
export const CLASSES_PAGE = "/academics/classes";
export const TIMETABLE_PAGE = "/academics/timetable";

/* Where a readiness or draft problem is fixed, when there is one obvious page */
export function fixLink(issue: Issue): { to: string; label: string } | null {
  const section = issue.sectionId ? `${CURRICULUM}?section=${issue.sectionId}` : null;
  switch (issue.code) {
    case "NO_TEACHER":
      return section ? { to: section, label: "Assign a teacher" } : null;
    case "NO_WEEKLY_CLASSES":
      return section ? { to: section, label: "Set classes a week" } : null;
    case "SECTION_OVERLOADED":
      return section ? { to: section, label: "Section's subjects" } : null;
    case "MORE_THAN_WEEKLY":
      return issue.sectionId ? { to: `${TIMETABLE_PAGE}?sectionId=${issue.sectionId}`, label: "Open the timetable" } : null;
    case "TEACHER_OVERLOADED":
      return issue.teacherId ? { to: `${CURRICULUM}?tab=teacher&teacher=${issue.teacherId}`, label: "Teacher's subjects" } : null;
    case "NO_DOUBLE_PERIODS":
      return { to: PERIODS_PAGE, label: "Periods" };
    default:
      return null;
  }
}

/* "1.2 s" */
export const seconds = (ms: number | undefined) => (ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);
