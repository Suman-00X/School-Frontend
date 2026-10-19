import { Plus } from "lucide-react";
import { hhmm, type GridDay, type GridPeriod, type GridSlot, type TimetableGridData } from "../api/timetable";
import "./timetable.css";

/* ISO weekday (1 = Monday) and "HH:MM" on this device */
const nowParts = () => {
  const d = new Date();
  return { weekday: d.getDay() === 0 ? 7 : d.getDay(), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
};

export const cellKey = (weekday: number, periodId: string) => `${weekday}|${periodId}`;

/* A weekly timetable: periods (bell order) down, school days across. Breaks are thin grey rows.
   Every cell has the same height whether it holds a lesson, nothing, or an error.
   - show "teacher": cells show subject, teacher and room (a section's week)
   - show "section": cells show subject, section and room (a teacher's week)
   - onCellClick makes lesson cells clickable (empty ones too, for adding)
   - errors: messages by cellKey(weekday, periodId), shown in the cell word for word
   - highlightNow: today's column and the period running now */
export function TimetableGrid({
  grid,
  show,
  onCellClick,
  errors,
  highlightNow,
  "aria-label": ariaLabel
}: {
  grid: TimetableGridData;
  show: "teacher" | "section";
  onCellClick?: (day: GridDay, period: GridPeriod, slot: GridSlot | null) => void;
  errors?: Record<string, string>;
  highlightNow?: boolean;
  "aria-label"?: string;
}) {
  const now = highlightNow ? nowParts() : null;
  const periods = [...grid.periods].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.periodNumber - b.periodNumber);
  const isNow = (day: GridDay, p: GridPeriod) =>
    !!now && day.weekday === now.weekday && hhmm(p.startTime) <= now.time && now.time < hhmm(p.endTime);

  return (
    <div className="table-wrap">
      <table className="table tt-grid" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th className="tt-period-col">Period</th>
            {grid.days.map(d => (
              <th key={d.weekday} className={now?.weekday === d.weekday ? "tt-today" : undefined}>
                {d.name}
                {now?.weekday === d.weekday && <span className="tt-today-tag">Today</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map(p =>
            p.isBreak ? (
              <tr key={p.id} className="tt-break">
                <td className="tt-period-col">
                  <span className="tt-break-name">{p.name}</span>
                  <span className="tt-time">
                    {hhmm(p.startTime)}–{hhmm(p.endTime)}
                  </span>
                </td>
                <td colSpan={Math.max(grid.days.length, 1)} />
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="tt-period-col">
                  <div className="tt-period-name">{p.name}</div>
                  <div className="tt-time">
                    {hhmm(p.startTime)}–{hhmm(p.endTime)}
                  </div>
                </td>
                {grid.days.map(d => {
                  const slot = d.slots.find(s => s.period.id === p.id) ?? null;
                  const error = errors?.[cellKey(d.weekday, p.id)];
                  const second = slot ? [show === "teacher" ? slot.teacher?.name : slot.section?.name, slot.room].filter(Boolean).join(" · ") : "";
                  const classes = ["tt-cell", slot ? "has-lesson" : "is-empty", error && "has-error", isNow(d, p) && "is-now", onCellClick && "is-clickable"]
                    .filter(Boolean)
                    .join(" ");
                  const body = (
                    <>
                      <span className="tt-subject">{slot ? (slot.subject?.subjectName ?? "Lesson") : onCellClick ? <Plus aria-hidden /> : ""}</span>
                      <span className={`tt-sub${error ? " tt-error" : ""}`} title={error ?? second}>
                        {error ?? second}
                      </span>
                    </>
                  );
                  return (
                    <td key={d.weekday} className="tt-td">
                      {onCellClick ? (
                        <button
                          type="button"
                          className={classes}
                          onClick={() => onCellClick(d, p, slot)}
                          aria-label={slot ? `${d.name} ${p.name}: ${slot.subject?.subjectName ?? "lesson"}${second ? `, ${second}` : ""}` : `Add a lesson on ${d.name} ${p.name}`}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className={classes}>{body}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
