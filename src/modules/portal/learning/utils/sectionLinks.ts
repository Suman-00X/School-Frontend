import type { TeachingSection } from "../api/learning";

/* The academics work pages for one section (they read ?sectionId= from the URL) */
export function sectionLinks(s: TeachingSection, can: (key: string) => boolean) {
  const q = `sectionId=${encodeURIComponent(s.sectionId)}`;
  const leads = s.isClassTeacher || s.isDeputyClassTeacher;
  return [
    { label: "Take attendance", to: `/academics/attendance?${q}`, show: can("academics.attendance.record") },
    { label: "Marks", to: `/academics/marks?${q}`, show: can("academics.marks.record") && s.subjectIds.length > 0 },
    { label: "Homework", to: `/academics/homework?${q}`, show: can("academics.homework.read") },
    { label: "Timetable", to: `/academics/timetable?tab=section&${q}`, show: can("academics.timetable.read") },
    { label: "Report cards", to: `/academics/results?${q}`, show: leads && can("academics.reportCards.read") }
  ].filter(l => l.show);
}
