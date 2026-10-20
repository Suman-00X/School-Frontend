/* "08:30:00" -> "08:30" */
export const hhmm = (time: string) => time.slice(0, 5);

export const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/* "Today", "Tomorrow", else "Thursday, 22 October" */
export const dayName = (iso: string, today: string) => {
  if (iso === today) return "Today";
  if (iso === shiftDate(today, 1)) return "Tomorrow";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
};

export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
