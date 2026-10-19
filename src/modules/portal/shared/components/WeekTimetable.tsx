import { useState } from "react";
import { Tabs } from "@/common/ui";
import { TimetableGrid as WeekGrid, type TimetableGridData } from "@/modules/academics";
import { formatClock, isWeekdayToday, minutesOf, useNow } from "../utils/time";

/* GET /me/students/:id/timetable and /me/teaching/timetable share this shape (academics' grid data) */
export type { TimetableGridData };
export type TimetablePeriod = TimetableGridData["periods"][number];
export type TimetableDay = TimetableGridData["days"][number];
export type TimetableSlot = TimetableDay["slots"][number];

/* A read-only week. Wide screens: academics' weekly grid (days across, periods down, today
   and the running period highlighted). Phones: a day picker (today first) with that day's
   periods as a list. */
export function WeekTimetable({ grid, show }: { grid: TimetableGridData; show: "teacher" | "section" }) {
  const now = useNow();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const periods = [...grid.periods].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.periodNumber - b.periodNumber);
  const todayDay = grid.days.find(d => isWeekdayToday(d.weekday, now));
  const [picked, setPicked] = useState<number | null>(null);
  const day = grid.days.find(d => d.weekday === picked) ?? todayDay ?? grid.days[0];
  const isNow = (p: TimetablePeriod) => day === todayDay && minutes >= minutesOf(p.startTime) && minutes < minutesOf(p.endTime);

  return (
    <>
      <div className="po-tt-wrap">
        <WeekGrid grid={grid} show={show} highlightNow aria-label="Weekly timetable" />
      </div>
      <div className="po-tt-day">
        <div className="po-tt-day-picker">
          <Tabs
            tabs={grid.days.map(d => ({ id: String(d.weekday), label: d === todayDay ? `${d.name.slice(0, 3)} · today` : d.name.slice(0, 3) }))}
            value={String(day?.weekday ?? "")}
            onChange={id => setPicked(Number(id))}
          />
        </div>
        {day && (
          <ul className="po-tt-day-list">
            {periods.map(p => {
              const slot = day.slots.find(s => s.period.id === p.id);
              const second = slot ? [show === "teacher" ? slot.teacher?.name : slot.section?.name, slot.room].filter(Boolean).join(" · ") : "";
              return (
                <li key={p.id} className={[p.isBreak && "po-tt-break", !p.isBreak && isNow(p) && "is-now"].filter(Boolean).join(" ") || undefined}>
                  <div>
                    {!p.isBreak && <div className="po-tt-period-name">{p.name}</div>}
                    <div className="po-tt-period-time">{formatClock(p.startTime)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {p.isBreak ? (
                      p.name
                    ) : slot ? (
                      <>
                        <div className="po-tt-subject">{slot.subject?.subjectName ?? "Lesson"}</div>
                        <div className="po-tt-line">{second}</div>
                      </>
                    ) : (
                      <span className="po-tt-free">Free</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
