import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Wallet } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Badge, Button, Card, DataTable, EmptyState, PersonCell, RoleBadge, SearchInput, Select, type Column } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { matchesSearch } from "@/modules/users/shared";
import { useHrEmployees } from "../../shared/api/employees";
import { useMoney } from "../../shared/hooks/useMoney";
import { monthLabel, monthOf } from "../../shared/utils/format";
import { revisionTotals, useAllSalaries, type SalaryRevision } from "../api/payroll";
import { RevisionFormDrawer } from "./RevisionFormDrawer";
import { SalaryDrawer } from "./SalaryDrawer";

/* One row per employee: the revision in force today, upcoming ones, and how many there are */
type Row = {
  userId: string;
  name: string;
  role: string | null;
  code: string | null;
  revisions: SalaryRevision[];
  current: SalaryRevision | null;
  upcoming: SalaryRevision | null;
};

const SHOW = [
  { value: "", label: "Everyone" },
  { value: "with", label: "With a salary" },
  { value: "without", label: "No salary yet", description: "Payroll leaves them out" }
];

/* HR-02 Employee salaries. There is no "current salary" endpoint, so every revision is loaded and
   grouped per employee here. With a full employee directory, people without a salary are listed too. */
export function EmployeeSalariesPanel() {
  const { can } = useAuth();
  const money = useMoney();
  const canManage = can("hr.employeeSalaries.manage");
  const salaries = useAllSalaries();
  const { employees, complete } = useHrEmployees();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("");
  const today = todayIso();

  const rows = useMemo<Row[]>(() => {
    const byUser = new Map<string, Row>();
    for (const r of salaries.data ?? []) {
      let row = byUser.get(r.userId);
      if (!row) {
        row = { userId: r.userId, name: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : r.userId, role: r.user?.role ?? null, code: null, revisions: [], current: null, upcoming: null };
        byUser.set(r.userId, row);
      }
      row.revisions.push(r);
    }
    for (const row of byUser.values()) {
      row.revisions.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      row.current = row.revisions.find(r => r.effectiveFrom <= today) ?? null;
      row.upcoming = [...row.revisions].reverse().find(r => r.effectiveFrom > today) ?? null;
    }
    for (const e of employees) {
      const row = byUser.get(e.userId);
      if (row) row.code = e.employeeCode ?? null;
      else if (complete) byUser.set(e.userId, { userId: e.userId, name: e.name, role: e.role ?? null, code: e.employeeCode ?? null, revisions: [], current: null, upcoming: null });
    }
    return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [salaries.data, employees, complete, today]);

  const openId = params.get("userId");
  const newFor = params.get("new");
  const open = rows.find(r => r.userId === openId) ?? null;
  const [form, setForm] = useState<{ userId?: string; name?: string; from?: SalaryRevision | null } | null>(null);

  const setOpen = (userId: string | null) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (userId) next.set("userId", userId);
        else next.delete("userId");
        next.delete("new");
        next.delete("name");
        return next;
      },
      { replace: true }
    );

  /* ?new=<userId> (from a payroll run's "without salary" list) opens the form for that person */
  const linked = newFor ? rows.find(r => r.userId === newFor) : undefined;
  const formOpen = !!form || (!!newFor && canManage && !salaries.isLoading);
  const formProps = form ?? (newFor ? { userId: newFor, name: linked?.name ?? params.get("name") ?? undefined, from: linked?.current ?? linked?.revisions[0] ?? null } : null);
  const closeForm = () => {
    setForm(null);
    if (newFor)
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete("new");
          next.delete("name");
          return next;
        },
        { replace: true }
      );
  };

  const visible = rows.filter(
    r => (!search.trim() || matchesSearch(search, r.name, r.code)) && (show === "" || (show === "with" ? r.revisions.length > 0 : r.revisions.length === 0))
  );

  const totalsOf = (r: SalaryRevision) => revisionTotals(r.monthlyBasic, r.lines.map(l => ({ kind: l.component.kind, calculation: l.component.calculation, value: l.value })));

  const columns: Column<Row>[] = [
    { key: "name", header: "Employee", render: r => <PersonCell name={r.name} sub={r.code ?? undefined} extra={<RoleBadge role={r.role} />} /> },
    {
      key: "from",
      header: "Effective from",
      render: r =>
        r.current ? (
          <span className="row nowrap" style={{ gap: 6 }}>
            {monthLabel(monthOf(r.current.effectiveFrom))}
            {r.upcoming && <Badge tone="info">New from {monthLabel(monthOf(r.upcoming.effectiveFrom))}</Badge>}
          </span>
        ) : r.upcoming ? (
          <Badge tone="info">Starts {monthLabel(monthOf(r.upcoming.effectiveFrom))}</Badge>
        ) : (
          <Badge tone="warning">No salary yet</Badge>
        )
    },
    { key: "basic", header: "Monthly basic", align: "right", render: r => (r.current ? <span className="hr-num">{money(r.current.monthlyBasic)}</span> : <span className="muted">—</span>) },
    { key: "lines", header: "Components", align: "right", render: r => (r.current ? <span className="hr-num">{r.current.lines.length}</span> : <span className="muted">—</span>) },
    { key: "gross", header: "Gross", align: "right", render: r => (r.current ? <span className="hr-num">{money(totalsOf(r.current).gross)}</span> : <span className="muted">—</span>) },
    { key: "net", header: "Net", align: "right", render: r => (r.current ? <strong className="hr-num">{money(totalsOf(r.current).net)}</strong> : <span className="muted">—</span>) },
    { key: "bank", header: "Bank account", render: r => (r.current?.bankAccountNumber ? <span className="mono small">{r.current.bankAccountNumber}</span> : <span className="muted">—</span>) },
    { key: "count", header: "Revisions", align: "right", render: r => <span className="hr-num">{r.revisions.length}</span> }
  ];

  return (
    <>
      <Card flush>
        <div className="filter-bar">
          <div className="field">
            <label className="field-label">Search</label>
            <SearchInput placeholder="Name or code" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search employees" />
          </div>
          <Select label="Show" className="select-sm" value={show} required options={complete ? SHOW : SHOW.slice(0, 2)} onChange={e => setShow(e.target.value)} />
          {canManage && (
            <div className="row" style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setForm({})}>
                New salary
              </Button>
            </div>
          )}
        </div>
        <DataTable
          rows={salaries.data ? visible : undefined}
          rowKey={r => r.userId}
          loading={salaries.isLoading}
          error={salaries.error}
          onRetry={() => void salaries.refetch()}
          onRowClick={r => setOpen(r.userId)}
          columns={columns}
          empty={
            rows.length ? (
              <EmptyState icon={<Wallet />} title="Nobody matches" />
            ) : (
              <EmptyState
                icon={<Wallet />}
                title="No salaries yet"
                message="Add each employee's monthly basic and components; payroll uses the one in force on the 1st of the month."
                actions={
                  canManage && (
                    <Button variant="primary" icon={<Plus />} onClick={() => setForm({})}>
                      New salary
                    </Button>
                  )
                }
              />
            )
          }
        />
        {!complete && rows.length > 0 && (
          <div className="table-footer">
            <span className="small muted">Only employees who already have a salary are listed. To add someone new, use New salary and paste their user id.</span>
          </div>
        )}
      </Card>
      <SalaryDrawer
        key={open?.userId ?? "none"}
        open={!!open && !formOpen}
        onClose={() => setOpen(null)}
        name={open?.name ?? ""}
        revisions={open?.revisions ?? []}
        currentId={open?.current?.id ?? null}
        canManage={canManage}
        onRevise={from => setForm({ userId: open!.userId, name: open!.name, from })}
        onAdd={() => setForm({ userId: open!.userId, name: open!.name })}
      />
      <RevisionFormDrawer
        open={formOpen}
        onClose={closeForm}
        userId={formProps?.userId}
        employeeName={formProps?.name}
        from={formProps?.from}
        history={salaries.data ?? []}
        onSaved={r => setOpen(r.userId)}
      />
    </>
  );
}
