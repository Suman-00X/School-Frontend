/* Academics › Attendance pages */
export const ATTENDANCE_PAGES = {
  register: "/academics/attendance",
  cover: "/academics/attendance/cover",
  missing: "/academics/attendance/missing-registers",
  leave: "/academics/attendance/leave-requests"
} as const;

/* The register page opened on one section, date and register ("DAY", "FN", "P3") */
export const registerLink = (sectionId: string, date: string, key?: string) => {
  const q = new URLSearchParams({ sectionId, date });
  if (key) q.set("register", key);
  return `${ATTENDANCE_PAGES.register}?${q.toString()}`;
};
