import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useApiList, useListParams } from "@/common/hooks";
import {
  Badge,
  Button,
  CalendarLegend,
  Card,
  DataTable,
  Dialog,
  DescriptionList,
  EmptyState,
  MonthCalendar,
  Page,
  PageHeader,
  Tabs,
  addMonths,
  monthGridRange,
  monthLabel,
  monthOf,
  monthRange
} from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { CALENDAR_PATH, EVENT_LABELS, EVENT_TONES, EVENT_TYPES, type CalendarEvent, type EventType } from "../api/learning";
import "../../shared/portal.css";

const VIEWS = [
  { id: "month", label: "Month" },
  { id: "list", label: "List" }
];

const dateSpan = (e: CalendarEvent) => (e.endDate && e.endDate !== e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : formatDate(e.startDate));

/* Every day from start to end (inclusive) */
function daysOf(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last && out.length < 400) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* PO-09 · Calendar: the school's holidays, exams and events this year, as a month grid or a
   list. Holidays and vacations are shaded. Not about one child: everyone sees the same. */
export default function CalendarPage() {
  const { params, setParams } = useListParams({ month: "", view: "month", types: "" });
  const month = params.month || monthOf(todayIso());
  const grid = monthGridRange(month);
  const list = useApiList<CalendarEvent>(CALENDAR_PATH, { from: grid.from, to: grid.to, limit: 100 });
  const [open, setOpen] = useState<CalendarEvent | null>(null);

  const picked = useMemo(() => new Set((params.types ? params.types.split(",") : []) as EventType[]), [params.types]);
  const shown = useMemo(() => (list.rows ?? []).filter(e => !picked.size || picked.has(e.eventType)), [list.rows, picked]);

  const closedDays = useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of list.rows ?? []) if (e.isHoliday) for (const d of daysOf(e.startDate, e.endDate ?? e.startDate)) out[d] = e.title;
    return out;
  }, [list.rows]);

  const { from, to } = monthRange(month);
  const inMonth = shown.filter(e => e.startDate <= to && (e.endDate ?? e.startDate) >= from);

  const toggle = (t: EventType) => {
    const next = new Set(picked);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setParams({ types: [...next].join(",") });
  };

  const setMonth = (m: string) => setParams({ month: m === monthOf(todayIso()) ? "" : m });

  return (
    <Page>
      <PageHeader title="School calendar" subtitle="Holidays, exams and events this year" />
      <Card flush>
        <div className="filter-bar" style={{ alignItems: "center" }}>
          <div className="po-chips" role="group" aria-label="Event types">
            {EVENT_TYPES.map(t => (
              <button key={t} type="button" className="po-toggle" aria-pressed={picked.has(t)} onClick={() => toggle(t)}>
                {EVENT_LABELS[t]}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Tabs tabs={VIEWS} value={params.view} onChange={v => setParams({ view: v })} />
          </div>
        </div>
        <div className="card-body">
          {params.view === "list" ? (
            <div className="stack">
              <div className="row-between">
                <h3>{monthLabel(month)}</h3>
                <div className="row">
                  <Button size="sm" variant="ghost" icon={<ChevronLeft />} onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" />
                  <Button size="sm" variant="ghost" icon={<ChevronRight />} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" />
                </div>
              </div>
              <DataTable
                rows={list.rows ? inMonth : undefined}
                rowKey={e => e.id}
                loading={list.isLoading}
                error={list.error}
                onRetry={() => void list.refetch()}
                onRowClick={setOpen}
                empty={<EmptyState icon={<CalendarDays />} title="No events this month" />}
                columns={[
                  { key: "date", header: "Date", render: e => <span className="nowrap">{dateSpan(e)}</span> },
                  { key: "title", header: "Event", render: e => <strong style={{ fontWeight: 550 }}>{e.title}</strong> },
                  {
                    key: "type",
                    header: "Type",
                    render: e => (
                      <Badge tone={EVENT_TONES[e.eventType]} dot>
                        {EVENT_LABELS[e.eventType]}
                      </Badge>
                    )
                  },
                  { key: "closed", header: "School", render: e => (e.isHoliday ? "Closed" : <span className="muted">Open</span>) }
                ]}
              />
            </div>
          ) : (
            <div className="stack-sm">
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                events={shown.map(e => ({ id: e.id, title: e.title, startDate: e.startDate, endDate: e.endDate, tone: EVENT_TONES[e.eventType] }))}
                closedDays={closedDays}
                onEventClick={id => setOpen(shown.find(e => e.id === id) ?? null)}
                summary={list.rows ? (inMonth.length ? `${inMonth.length} event${inMonth.length === 1 ? "" : "s"}` : "No events this month") : undefined}
              />
              <CalendarLegend items={EVENT_TYPES.map(t => ({ tone: EVENT_TONES[t], label: EVENT_LABELS[t] }))} />
            </div>
          )}
        </div>
      </Card>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        {open && (
          <DescriptionList
            columns={2}
            items={[
              { label: "When", value: dateSpan(open) },
              {
                label: "Type",
                value: (
                  <Badge tone={EVENT_TONES[open.eventType]} dot>
                    {EVENT_LABELS[open.eventType]}
                  </Badge>
                )
              },
              { label: "School", value: open.isHoliday ? "Closed" : "Open as usual" },
              { label: "Details", value: open.description, wide: true }
            ]}
          />
        )}
      </Dialog>
    </Page>
  );
}
