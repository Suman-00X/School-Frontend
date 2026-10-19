/* AC-05 · School calendar (Academics › Setup) */
import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useListParams } from "@/common/hooks";
import {
  Badge,
  Button,
  CalendarLegend,
  Card,
  DataTable,
  EmptyState,
  monthGridRange,
  monthOf,
  monthRange,
  MonthCalendar,
  Page,
  PageHeader,
  Select,
  Tabs
} from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { closedReason, EVENT_TYPES, EVENTS_PATH, eventTone, eventTypeLabel, useEventsBetween, useWorkingDays, type CalendarEvent } from "../api/calendar";
import { EventDrawer, eventDates } from "../components/EventDrawer";
import "../../shared/components/setup.css";

const typeOptions = EVENT_TYPES.map(t => ({ value: t.value, label: t.label }));

export default function CalendarPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setParams, setPage } = useListParams({ view: "month", month: "", type: "" });
  const canCreate = can("academics.calendar.create") && !readOnly;
  const canUpdate = can("academics.calendar.update") && !readOnly;
  const canDelete = can("academics.calendar.remove") && !readOnly;
  const [drawer, setDrawer] = useState<{ event: CalendarEvent | null; date?: string } | null>(null);
  const view = params.view === "list" ? "list" : "month";

  /* The month shown: from the URL, else this month when it is in the year, else the year's first */
  const today = todayIso();
  const minMonth = year ? monthOf(year.startDate) : undefined;
  const maxMonth = year ? monthOf(year.endDate) : undefined;
  const fallback = !year || (today >= year.startDate && today <= year.endDate) ? monthOf(today) : monthOf(year.startDate);
  const month = /^\d{4}-\d{2}$/.test(params.month) ? params.month : fallback;

  const typeFilter = (
    <Select
      aria-label="Event type"
      className="select-sm"
      options={typeOptions}
      value={params.type}
      placeholder="All types"
      onChange={e => setParams({ type: e.target.value })}
    />
  );

  return (
    <Page>
      <PageHeader
        title="Calendar"
        subtitle={`Holidays, exams and events of ${year?.yearName ?? "the year chosen in the header"}. Closed days are shaded and don't count as working days.`}
        actions={
          canCreate && (
            <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ event: null })}>
              New event
            </Button>
          )
        }
      />
      <Tabs
        tabs={[
          { id: "month", label: "Month" },
          { id: "list", label: "List" }
        ]}
        value={view}
        onChange={id => setParams({ view: id })}
      />
      {view === "month" ? (
        <MonthView
          month={month}
          minMonth={minMonth}
          maxMonth={maxMonth}
          type={params.type}
          filter={typeFilter}
          onMonth={m => setParams({ month: m })}
          onDay={canCreate ? d => setDrawer({ event: null, date: d }) : undefined}
          onEvent={e => setDrawer({ event: e })}
        />
      ) : (
        <ListView type={params.type} filter={typeFilter} page={params.page} limit={params.limit} onPage={setPage} onOpen={e => setDrawer({ event: e })} onCreate={canCreate ? () => setDrawer({ event: null }) : undefined} />
      )}
      <EventDrawer
        open={!!drawer}
        event={drawer?.event ?? null}
        date={drawer?.date}
        canEdit={drawer?.event ? canUpdate : canCreate}
        canDelete={canDelete}
        onClose={() => setDrawer(null)}
      />
    </Page>
  );
}

function MonthView({
  month,
  minMonth,
  maxMonth,
  type,
  filter,
  onMonth,
  onDay,
  onEvent
}: {
  month: string;
  minMonth?: string;
  maxMonth?: string;
  type: string;
  filter: ReactNode;
  onMonth: (m: string) => void;
  onDay?: (date: string) => void;
  onEvent: (e: CalendarEvent) => void;
}) {
  const { selected: year } = useAcademicYear();
  const grid = monthGridRange(month);
  const own = monthRange(month);
  const events = useEventsBetween(grid.from, grid.to, type, year?.id);
  const days = useWorkingDays(grid.from, grid.to, year?.id);

  /* Closed days with why; days outside the year are closed too (nothing can be scheduled there) */
  const closedDays = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of days.data?.closedDays ?? []) out[c.date] = closedReason(c);
    if (year) {
      const start = new Date(grid.from + "T00:00:00");
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (iso < year.startDate || iso > year.endDate) out[iso] = `Outside ${year.yearName}`;
      }
    }
    return out;
  }, [days.data, year, grid.from]);

  const working = days.data ? days.data.workingDays.filter(d => d >= own.from && d <= own.to).length : null;
  const byId = new Map((events.data ?? []).map(e => [e.id, e]));
  const inYear = (d: string) => !year || (d >= year.startDate && d <= year.endDate);

  return (
    <Card>
      <div className="stack">
        <MonthCalendar
          month={month}
          onMonthChange={onMonth}
          minMonth={minMonth}
          maxMonth={maxMonth}
          events={(events.data ?? []).map(e => ({ id: e.id, title: e.title, startDate: e.startDate, endDate: e.endDate, tone: eventTone(e.eventType) }))}
          closedDays={closedDays}
          onDayClick={onDay ? d => inYear(d) && onDay(d) : undefined}
          onEventClick={id => {
            const e = byId.get(id);
            if (e) onEvent(e);
          }}
          summary={working !== null ? `${working} working day${working === 1 ? "" : "s"}` : events.error || days.error ? "Couldn't load this month" : ""}
          actions={filter}
        />
        <CalendarLegend items={EVENT_TYPES.map(t => ({ tone: t.tone, label: t.label }))} />
        <p className="small muted" style={{ margin: 0 }}>
          <span className="cal-swatch closed" style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Closed: weekly off days, holidays and vacations.{onDay ? " Click a day to add an event on it." : ""}
        </p>
      </div>
    </Card>
  );
}

function ListView({
  type,
  filter,
  page,
  limit,
  onPage,
  onOpen,
  onCreate
}: {
  type: string;
  filter: ReactNode;
  page: number;
  limit: number;
  onPage: (p: number) => void;
  onOpen: (e: CalendarEvent) => void;
  onCreate?: () => void;
}) {
  const list = useApiList<CalendarEvent>(EVENTS_PATH, { page, limit, eventType: type || undefined });
  const rows = list.rows ? [...list.rows].sort((a, b) => a.startDate.localeCompare(b.startDate)) : undefined;
  return (
    <Card flush>
      <div className="filter-bar">
        <div className="field">
          <span className="field-label">Type</span>
          {filter}
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={e => e.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={onPage}
        onRowClick={onOpen}
        empty={
          <EmptyState
            icon={<CalendarDays />}
            title={type ? `No ${eventTypeLabel(type).toLowerCase()} events this year` : "Nothing on the calendar yet"}
            message={type ? undefined : "Add the year's holidays, vacations and exam weeks so attendance knows which days are school days."}
            actions={
              onCreate &&
              !type && (
                <Button variant="primary" icon={<Plus />} onClick={onCreate}>
                  New event
                </Button>
              )
            }
          />
        }
        columns={[
          { key: "dates", header: "Dates", render: e => <span className="nowrap">{eventDates(e)}</span> },
          {
            key: "title",
            header: "Event",
            render: e => (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 550 }}>{e.title}</div>
                {e.description && <div className="small muted">{e.description}</div>}
              </div>
            )
          },
          { key: "type", header: "Type", render: e => <Badge tone={eventTone(e.eventType)}>{eventTypeLabel(e.eventType)}</Badge> },
          { key: "closed", header: "School", render: e => (e.isHoliday ? <Badge tone="warning">Closed</Badge> : <span className="muted">Open</span>) }
        ]}
      />
    </Card>
  );
}
