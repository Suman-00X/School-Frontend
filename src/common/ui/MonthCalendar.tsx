import { useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tone } from "./Badge";
import { Button } from "./Button";
import "./MonthCalendar.css";

/* A month grid (always six weeks, so it never changes height) with event chips and shaded
   closed days:
   <MonthCalendar month="2026-10" onMonthChange={setMonth} events={[{ id, title, startDate, endDate, tone }]}
     closedDays={{ "2026-10-02": "Gandhi Jayanti" }} onDayClick={d => …} onEventClick={id => …} />
   Dates are school days ("YYYY-MM-DD"), never shifted by time zone. On phones the chips
   become coloured dots. */

export type CalendarItem = {
  id: string;
  title: string;
  startDate: string;
  /* Inclusive; defaults to startDate */
  endDate?: string | null;
  tone?: Tone;
};

export type MonthCalendarProps = {
  /* "YYYY-MM" */
  month: string;
  onMonthChange?: (month: string) => void;
  events?: CalendarItem[];
  /* Days the school is closed, with why (shown on hover) */
  closedDays?: Record<string, string>;
  /* Clicking a day (e.g. to add an event on it). Without it days aren't clickable. */
  onDayClick?: (date: string) => void;
  onEventClick?: (id: string) => void;
  /* 0 = Sunday (default), 1 = Monday */
  weekStartsOn?: 0 | 1;
  /* Earliest and latest months the arrows may reach ("YYYY-MM") */
  minMonth?: string;
  maxMonth?: string;
  /* Next to the month name (e.g. "21 working days") */
  summary?: ReactNode;
  /* Right of the navigation (e.g. a filter) */
  actions?: ReactNode;
  /* Chips per day before "+N more" */
  maxChips?: number;
  /* Today, defaults to the device's date */
  today?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1);
};

export const monthOf = (date: string) => date.slice(0, 7);

/* "2026-10" + 1 → "2026-11" */
export function addMonths(month: string, n: number) {
  const d = parseMonth(month);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/* The six-week grid's first and last day, for fetching what it shows */
export function monthGridRange(month: string, weekStartsOn: 0 | 1 = 0) {
  const first = parseMonth(month);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
  return { from: iso(start), to: iso(end) };
}

/* The month's own first and last day */
export function monthRange(month: string) {
  const first = parseMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: iso(first), to: iso(last) };
}

export const monthLabel = (month: string) => parseMonth(month).toLocaleDateString(undefined, { month: "long", year: "numeric" });

const WEEKDAY_NAMES = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(2026, 1, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));

export function MonthCalendar({
  month,
  onMonthChange,
  events = [],
  closedDays = {},
  onDayClick,
  onEventClick,
  weekStartsOn = 0,
  minMonth,
  maxMonth,
  summary,
  actions,
  maxChips = 3,
  today
}: MonthCalendarProps) {
  const todayIso = today ?? iso(new Date());
  const { from } = monthGridRange(month, weekStartsOn);

  const days = useMemo(() => {
    const start = new Date(from + "T00:00:00");
    return Array.from({ length: 42 }, (_, i) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }, [from]);

  /* Events per day, longest first so multi-day events line up across a week */
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const sorted = [...events].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate)
    );
    for (const e of sorted) {
      const end = e.endDate && e.endDate > e.startDate ? e.endDate : e.startDate;
      for (const d of days) if (d >= e.startDate && d <= end) map.set(d, [...(map.get(d) ?? []), e]);
    }
    return map;
  }, [events, days]);

  const order = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
  const canPrev = !minMonth || month > minMonth;
  const canNext = !maxMonth || month < maxMonth;

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          {onMonthChange && (
            <>
              <Button size="sm" variant="ghost" icon={<ChevronLeft />} disabled={!canPrev} onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month" />
              <Button size="sm" variant="ghost" icon={<ChevronRight />} disabled={!canNext} onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month" />
            </>
          )}
          <h3 className="cal-title">{monthLabel(month)}</h3>
          {/* Reserved: the summary arriving never moves the title */}
          <span className="cal-summary">{summary}</span>
        </div>
        <div className="row cal-actions">
          {/* Always there (disabled on this month), so the toolbar never shifts */}
          {onMonthChange && (
            <Button
              size="sm"
              disabled={monthOf(todayIso) === month || (!!minMonth && monthOf(todayIso) < minMonth) || (!!maxMonth && monthOf(todayIso) > maxMonth)}
              onClick={() => onMonthChange(monthOf(todayIso))}
            >
              Today
            </Button>
          )}
          {actions}
        </div>
      </div>
      <div className="cal-grid" role="grid" aria-label={monthLabel(month)}>
        {order.map(d => (
          <div key={d} className="cal-weekday" role="columnheader">
            {WEEKDAY_NAMES[d]}
          </div>
        ))}
        {days.map(d => {
          const items = byDay.get(d) ?? [];
          const closed = closedDays[d];
          const outside = monthOf(d) !== month;
          const shown = items.slice(0, maxChips);
          const more = items.length - shown.length;
          const cls = ["cal-day", outside && "is-outside", closed !== undefined && "is-closed", d === todayIso && "is-today", onDayClick && "is-clickable"]
            .filter(Boolean)
            .join(" ");
          const label = `${new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${closed ? `, closed: ${closed}` : ""}${items.length ? `, ${items.length} event${items.length === 1 ? "" : "s"}` : ""}`;
          return (
            <div
              key={d}
              role="gridcell"
              className={cls}
              title={closed || undefined}
              aria-label={label}
              tabIndex={onDayClick ? 0 : undefined}
              onClick={onDayClick ? () => onDayClick(d) : undefined}
              onKeyDown={
                onDayClick
                  ? e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDayClick(d);
                      }
                    }
                  : undefined
              }
            >
              <span className="cal-date">{Number(d.slice(8))}</span>
              <div className="cal-chips">
                {shown.map(e => {
                  const starts = d === e.startDate || d === days[0] || new Date(d + "T00:00:00").getDay() === weekStartsOn;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`cal-chip cal-chip-${e.tone ?? "neutral"}${starts ? "" : " is-continued"}`}
                      title={e.title}
                      onClick={
                        onEventClick
                          ? ev => {
                              ev.stopPropagation();
                              onEventClick(e.id);
                            }
                          : undefined
                      }
                      tabIndex={onEventClick ? 0 : -1}
                    >
                      <span className="cal-chip-text">{e.title}</span>
                    </button>
                  );
                })}
                {more > 0 && <span className="cal-more">+{more} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* A colour key under a calendar: [{ tone, label }] */
export function CalendarLegend({ items }: { items: { tone: Tone; label: string }[] }) {
  return (
    <div className="cal-legend">
      {items.map(i => (
        <span key={i.label} className="cal-legend-item">
          <span className={`cal-swatch cal-chip-${i.tone}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
