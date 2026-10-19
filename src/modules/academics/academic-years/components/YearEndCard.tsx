/* AC-01 year-end checklist: the three steps of the "Year end" workflow (API.md) for the year being
   closed: promote its sections into the next year (AC-12), make the next year current, archive it.
   There is no roll-over endpoint and no count of students still active in a year, so step 1 is a
   link and the archive refusal ("N students are still active…") is the check. */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArrowUpRight, CalendarCheck, Check, Plus } from "lucide-react";
import type { AcademicYear } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Button, Card } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { PROMOTION_PAGE } from "../../shared/utils/paths";
import "./yearEnd.css";

/* The year to close: the latest one that has ended but is neither current nor archived, else the current year */
function yearToClose(years: AcademicYear[], today: string) {
  const ended = years.filter(y => !y.archivedAt && !y.isCurrent && y.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate));
  return ended[0] ?? years.find(y => y.isCurrent && !y.archivedAt) ?? null;
}

type Step = { title: string; hint: ReactNode; done?: boolean; action?: ReactNode };

export function YearEndCard({
  onNewYear,
  onMakeCurrent,
  onArchive
}: {
  onNewYear?: () => void;
  onMakeCurrent: (year: AcademicYear) => void;
  onArchive: (year: AcademicYear) => void;
}) {
  const { can } = useAuth();
  const { years, selected, select } = useAcademicYear();
  const navigate = useNavigate();
  const today = todayIso();
  const closing = yearToClose(years, today);
  const canUpdate = can("academics.academicYears.update");
  const canArchive = can("academics.academicYears.archive");
  const canPromote = can("academics.enrollments.promote");
  /* An admin's to-do: nothing to show to those who can't act on it */
  if (!closing || (!canUpdate && !canArchive)) return null;

  const next = years.filter(y => !y.archivedAt && y.startDate > closing.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  const ended = closing.endDate < today;
  const name = closing.yearName;

  /* The promotion wizard promotes from the header's year: switch it to the year being closed */
  const promote = () => {
    if (selected?.id !== closing.id) select(closing.id);
    navigate(PROMOTION_PAGE);
  };

  const steps: Step[] = [
    next
      ? {
          title: `Promote each section into ${next.yearName}`,
          hint: `Move every student of ${name} up, keep repeaters back or mark leavers as left. Section by section; ${next.yearName} needs its sections first.`,
          action: canPromote && (
            <Button size="sm" icon={<ArrowUpRight />} onClick={promote}>
              Promote sections
            </Button>
          )
        }
      : {
          title: "Create the next year, then promote each section into it",
          hint: `Promotion moves ${name}'s students into the next year's sections, so that year and its sections come first.`,
          action: onNewYear && (
            <Button size="sm" icon={<Plus />} onClick={onNewYear}>
              New year
            </Button>
          )
        },
    {
      title: next ? `Make ${next.yearName} the current year` : "Make the next year current",
      done: !closing.isCurrent,
      hint: !closing.isCurrent
        ? `${years.find(y => y.isCurrent)?.yearName ?? "Another year"} is current. Teachers keep their ${name} sections for one month.`
        : `Every page then opens on it by default. Teachers keep their ${name} sections for one month.`,
      action: canUpdate && closing.isCurrent && next && (
        <Button size="sm" icon={<CalendarCheck />} onClick={() => onMakeCurrent(next)}>
          Make current
        </Button>
      )
    },
    {
      title: `Archive ${name}`,
      hint: closing.isCurrent
        ? "Possible once another year is current and this one has ended."
        : !ended
          ? `Possible after it ends on ${formatDate(closing.endDate)}.`
          : canArchive
            ? `Its academic records become read-only; fees stay payable. Refused while any student is still active in ${name}.`
            : "An administrator archives it. Its academic records then become read-only; fees stay payable.",
      action: canArchive && !closing.isCurrent && ended && (
        <Button size="sm" icon={<Archive />} onClick={() => onArchive(closing)}>
          Archive
        </Button>
      )
    }
  ];

  return (
    <Card
      title={`Year end: ${name}`}
      subtitle={`${name} ${ended ? "ended" : "ends"} on ${formatDate(closing.endDate)}. Three steps, in this order.`}
    >
      <ol className="year-end-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "done" : undefined}>
            <span className="year-end-mark" aria-hidden="true">
              {s.done ? <Check /> : i + 1}
            </span>
            <div className="year-end-text">
              <div className="year-end-title">
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </div>
              <div className="small muted">{s.hint}</div>
            </div>
            <div className="year-end-action">{s.action}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
