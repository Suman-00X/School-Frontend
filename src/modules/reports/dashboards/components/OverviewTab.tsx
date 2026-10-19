import { useApiGet } from "@/common/hooks";
import { Card, DescriptionList, StatTile, StatTiles, formatCompact } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { DASHBOARDS_PATH, monthLabel, pct, type Overview } from "../api/dashboards";
import { DashboardError } from "./ChartCard";

/* RP-01 Overview: headcounts, today's attendance, the fee position and upcoming exam papers */
export function OverviewTab() {
  const q = useApiGet<Overview>(`${DASHBOARDS_PATH}/overview`);
  if (q.error) return <DashboardError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const loading = !d;
  const money = (n: number | undefined) => (n === undefined ? "" : formatMoney(n, d?.currency));
  const h = d?.headcounts;
  const a = d?.attendanceToday;
  const f = d?.fees;
  const rateTone = f?.collectionRate == null ? "primary" : f.collectionRate >= 90 ? "success" : f.collectionRate >= 70 ? "warning" : "danger";
  const attendTone = a?.presentPercentage == null ? "primary" : a.presentPercentage >= 90 ? "success" : a.presentPercentage >= 75 ? "warning" : "danger";

  return (
    <div className="stack">
      <div className="dash-meta">
        {d ? (
          <>
            <span>
              Year <strong style={{ color: "var(--text)" }}>{d.academicYear.yearName}</strong>
            </span>
            <span>As of {formatDate(d.today)}</span>
            <span>Amounts in {d.currency}</span>
          </>
        ) : (
          <span>Loading…</span>
        )}
      </div>

      <h3 className="dash-section-title">People</h3>
      <StatTiles>
        <StatTile loading={loading} label="Students" value={h?.students.toLocaleString()} hint={h && `${h.admissionsLast30Days} admitted in the last 30 days`} />
        <StatTile loading={loading} label="Teachers" value={h?.teachers.toLocaleString()} hint="Teaching accounts" />
        <StatTile loading={loading} label="Staff" value={h?.staff.toLocaleString()} hint="Office, accounts and managers" />
        <StatTile loading={loading} label="Sections" value={h?.sections.toLocaleString()} hint={h && `${h.classes} classes`} />
        <StatTile loading={loading} label="New admissions" value={h?.admissionsLast30Days.toLocaleString()} hint="Last 30 days" />
      </StatTiles>

      <h3 className="dash-section-title">Today</h3>
      <StatTiles>
        <StatTile
          loading={loading}
          label="Present today"
          value={pct(a?.presentPercentage)}
          hint={a && (a.sectionsTaken === 0 ? "Registers not taken yet" : `${a.sectionsTaken} of ${a.sectionsTotal} sections taken`)}
          hintTone={a && a.sectionsTaken < a.sectionsTotal ? "warn" : undefined}
          meter={a?.presentPercentage ?? null}
          meterTone={attendTone}
        />
        <StatTile loading={loading} label="Absent today" value={a?.absent.toLocaleString()} hint={a && `${a.partlyAbsent} absent part of the day`} />
        <StatTile loading={loading} label="Exam papers" value={d?.exams.papersInNext14Days.toLocaleString()} hint="In the next 14 days" />
      </StatTiles>

      <h3 className="dash-section-title">Fees this year</h3>
      <StatTiles>
        <StatTile
          loading={loading}
          label="Net collected"
          value={money(f?.netCollectedThisYear)}
          hint={f && (f.refundedThisYear ? `${money(f.collectedThisYear)} less ${money(f.refundedThisYear)} refunded` : "Nothing refunded")}
          title={f ? money(f.netCollectedThisYear) : undefined}
        />
        <StatTile loading={loading} label="Collected this month" value={money(f?.collectedThisMonth)} hint={d && monthLabel(d.today.slice(0, 7))} />
        <StatTile loading={loading} label="Outstanding" value={money(f?.outstanding)} hint={f && `Of ${money(f.billed)} billed`} />
        <StatTile
          loading={loading}
          label="Overdue"
          value={money(f?.overdue)}
          hint={f && (f.overdueInvoices ? `${f.overdueInvoices} invoice${f.overdueInvoices === 1 ? "" : "s"} past due` : "Nothing overdue")}
          hintTone={f?.overdueInvoices ? "bad" : f ? "good" : undefined}
        />
        <StatTile
          loading={loading}
          label="Collection rate"
          value={pct(f?.collectionRate)}
          hint={f && (f.collectionRate === null ? "Nothing billed yet" : "Of what was billed")}
          meter={f?.collectionRate ?? null}
          meterTone={rateTone}
        />
      </StatTiles>

      <Card title="Fee details" subtitle="This academic year">
        {f ? (
          <DescriptionList
            columns={3}
            items={[
              { label: "Billed", value: money(f.billed) },
              { label: "Collected", value: money(f.collectedThisYear) },
              { label: "Refunded", value: money(f.refundedThisYear) },
              { label: "Concessions given", value: money(f.concessions) },
              { label: "Late fees charged", value: money(f.lateFees) },
              { label: "Late fees waived", value: money(f.lateFeesWaived) },
              { label: "Credit held for families", value: money(f.creditHeld) },
              { label: "Overdue invoices", value: formatCompact(f.overdueInvoices) }
            ]}
          />
        ) : (
          <DescriptionList columns={3} items={Array.from({ length: 8 }, (_, i) => ({ label: " ", value: <span className="skeleton" style={{ display: "inline-block", width: "60%", height: 12 }} key={i} /> }))} />
        )}
      </Card>
    </div>
  );
}
