/* LB-08 · Library reports: seven reports in a side list, each with its parameters, tiles, table and exports */
import { useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { FileDown } from "lucide-react";
import { api, isApiError, type Query } from "@/common/api";
import { useApiGet, useListParams } from "@/common/hooks";
import { SideNavLayout } from "@/common/layout/SideNav";
import {
  BarList,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Page,
  RoleBadge,
  Select,
  StatTile,
  StatTiles,
  TextInput,
  roleLabel,
  useToast,
  type Column
} from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { CopyStatusBadge } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { BORROWER_ROLES, FINE_METHOD_LABELS, ITEM_TYPE_LABELS, addDaysIso, isWhole } from "../../shared/utils/labels";
import type { CopyStatus, FineMethod, ItemType } from "../../shared/api/types";

type LoanRow = {
  loanId: string;
  title: string;
  accessionNumber: string;
  borrower: string;
  role: string;
  className: string;
  issuedOn: string;
  dueDate: string;
  daysOverdue: number;
  renewals: number;
  lateFine: number;
  fineOutstanding: number;
};
type CurrentLoans = { asOf: string; count: number; overdue: number; loans: LoanRow[] };
type Overdue = { asOf: string; count: number; finesAccrued: number; loans: LoanRow[] };
type FinesCollected = {
  from: string;
  to: string;
  collected: number;
  byMethod: Partial<Record<FineMethod, number>>;
  waived: number;
  waivers: number;
  payments: { id: string; paidOn: string; receiptNumber: string; borrowerUserId: string; borrower: string; className: string; title: string; accessionNumber: string; method: FineMethod; amount: number }[];
};
type FinesOutstanding = { asOf: string; total: number; borrowers: { borrowerUserId: string; borrower: string; role: string; className: string; loans: number; outstanding: number }[] };
type MostBorrowed = { from: string; to: string; titles: { bookId: string; title: string; authors: string; category: string | null; loans: number; borrowers: number }[] };
type Inactive = { since: string; count: number; borrowers: { userId: string; name: string; role: string; className: string; lastIssuedOn: string | null; loansEver: number }[] };
type Acquisitions = {
  from: string;
  to: string;
  count: number;
  totalValue: number;
  copies: { id: string; acquiredOn: string; accessionNumber: string; title: string; authors: string; itemType: ItemType; source: string | null; price: number | null; status: CopyStatus }[];
};

const REPORTS = [
  { id: "current-loans", label: "Books on loan", about: "Everything out right now, with fines so far" },
  { id: "overdue", label: "Overdue", about: "Books past their due date, most overdue first" },
  { id: "fines-collected", label: "Fines collected", about: "Payments and waivers in a period" },
  { id: "fines-outstanding", label: "Fines outstanding", about: "Who owes what today" },
  { id: "most-borrowed", label: "Most borrowed", about: "The titles lent most often in a period" },
  { id: "inactive-borrowers", label: "Inactive borrowers", about: "Students and staff with no loan since a date" },
  { id: "acquisitions", label: "Acquisitions", about: "Copies added in a period, with their value" }
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

const PERIOD = new Set<ReportId>(["fines-collected", "most-borrowed", "acquisitions"]);
const startOfMonth = () => `${todayIso().slice(0, 8)}01`;
const startOfYear = () => `${todayIso().slice(0, 4)}-01-01`;

export default function ReportsPage() {
  const { report = "" } = useParams();
  const meta = REPORTS.find(r => r.id === report);
  if (!meta) return <Navigate to="/library/reports/current-loans" replace />;
  return (
    <Page>
      <SideNavLayout groups={[{ items: REPORTS.map(r => ({ label: r.label, to: `/library/reports/${r.id}` })) }]}>
        {/* key: each report keeps its own parameters */}
        <Report key={meta.id} id={meta.id} about={meta.about} />
      </SideNavLayout>
    </Page>
  );
}

function Report({ id, about }: { id: ReportId; about: string }) {
  const toast = useToast();
  const money = useMoney();
  const defaults = {
    from: id === "acquisitions" ? startOfYear() : id === "most-borrowed" ? addDaysIso(-90) : startOfMonth(),
    to: todayIso(),
    since: addDaysIso(-90),
    role: "",
    limit: "20"
  };
  const { params, setParam } = useListParams(defaults);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  /* The parameters this report takes, checked before the call */
  const query: Query = {};
  const errors: Record<string, string> = {};
  if (PERIOD.has(id)) {
    query.from = params.from;
    query.to = params.to;
    if (!params.from) errors.from = "Pick a start date";
    if (!params.to) errors.to = "Pick an end date";
    else if (params.from && params.to < params.from) errors.to = "must be on or after the start";
  }
  if (id === "most-borrowed") {
    if (!isWhole(params.limit) || Number(params.limit) < 1 || Number(params.limit) > 100) errors.limit = "1 to 100";
    query.limit = params.limit;
  }
  if (id === "inactive-borrowers") {
    query.since = params.since;
    if (params.role) query.role = params.role;
    if (!params.since) errors.since = "Pick a date";
  }
  const valid = !Object.keys(errors).length;
  const path = `/library/reports/${id}`;
  const q = useApiGet<unknown>(valid ? path : null, query);
  /* The server's own field errors (e.g. to before from) next to the field */
  const serverField = isApiError(q.error) && q.error.isValidation ? q.error.fieldErrors() : {};
  const fieldError = (k: string) => errors[k] ?? serverField[k];

  const download = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      await api.download(path, { ...query, format }, `library-${id}.${format}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(null);
    }
  };

  const bar: ReactNode[] = [];
  if (PERIOD.has(id))
    bar.push(
      <TextInput key="from" label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} error={fieldError("from")} />,
      <TextInput key="to" label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} error={fieldError("to")} />
    );
  if (id === "most-borrowed")
    bar.push(
      <Select
        key="limit"
        label="Show"
        className="select-sm"
        value={params.limit}
        onChange={e => setParam("limit", e.target.value)}
        options={["10", "20", "50", "100"].map(n => ({ value: n, label: `Top ${n}` }))}
        error={fieldError("limit")}
      />
    );
  if (id === "inactive-borrowers")
    bar.push(
      <TextInput key="since" label="No loan since" type="date" className="input-sm" value={params.since} max={todayIso()} onChange={e => setParam("since", e.target.value)} error={fieldError("since")} />,
      <Select
        key="role"
        label="Who"
        className="select-sm"
        value={params.role}
        onChange={e => setParam("role", e.target.value)}
        placeholder="Every borrower"
        options={BORROWER_ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
        error={fieldError("role")}
      />
    );

  const data = q.data as never;
  return (
    <div className="stack">
      <div className="row-between" style={{ minHeight: 34, flexWrap: "nowrap", gap: 12 }}>
        <p className="muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {about}
        </p>
        <div className="row" style={{ flexShrink: 0 }}>
          <Button icon={<FileDown />} onClick={() => void download("csv")} loading={exporting === "csv"} disabled={!valid}>
            Export CSV
          </Button>
          <Button icon={<FileDown />} onClick={() => void download("xlsx")} loading={exporting === "xlsx"} disabled={!valid}>
            Export Excel
          </Button>
        </div>
      </div>
      <Card flush>
        {bar.length > 0 && <div className="lib-params lib-params-bar">{bar}</div>}
        <div style={{ padding: 14 }} className="stack">
          {q.error && !Object.keys(serverField).length ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : (
            <ReportBody id={id} data={data} loading={valid && q.isLoading} money={money} />
          )}
        </div>
      </Card>
    </div>
  );
}

const loanColumns = (money: (n: number) => string): Column<LoanRow>[] => [
  {
    key: "title",
    header: "Title",
    render: r => (
      <div style={{ minWidth: 0, maxWidth: 260 }}>
        <Link to={`/library/loans/${r.loanId}`} className="person-name" title={r.title}>
          {r.title}
        </Link>
        <div className="person-sub mono">{r.accessionNumber}</div>
      </div>
    )
  },
  { key: "borrower", header: "Borrower", render: r => r.borrower },
  { key: "role", header: "Role", render: r => <RoleBadge role={r.role} /> },
  { key: "className", header: "Class", render: r => r.className || <span className="muted">—</span> },
  { key: "issuedOn", header: "Issued", render: r => <span className="nowrap">{formatDate(r.issuedOn)}</span> },
  { key: "dueDate", header: "Due", render: r => <span className={`nowrap${r.daysOverdue ? " text-danger" : ""}`}>{formatDate(r.dueDate)}</span> },
  { key: "daysOverdue", header: "Days late", align: "right", render: r => (r.daysOverdue ? <span className="num text-danger">{r.daysOverdue}</span> : <span className="muted">—</span>) },
  { key: "renewals", header: "Renewals", align: "right", render: r => <span className="num">{r.renewals}</span> },
  { key: "lateFine", header: "Late fine so far", align: "right", render: r => (r.lateFine ? <span className="num">{money(r.lateFine)}</span> : <span className="muted">—</span>) },
  { key: "fineOutstanding", header: "Outstanding", align: "right", render: r => (r.fineOutstanding ? <strong className="num">{money(r.fineOutstanding)}</strong> : <span className="muted">—</span>) }
];

function ReportBody({ id, data, loading, money }: { id: ReportId; data: never; loading: boolean; money: (n: number | null | undefined) => string }) {
  const m = (n: number) => money(n);
  const empty = (title: string) => <EmptyState title={title} />;
  const tableProps = { loading, empty: empty("Nothing in this report") };

  switch (id) {
    case "current-loans": {
      const d = data as CurrentLoans | undefined;
      return (
        <>
          <StatTiles>
            <StatTile label="On loan" value={d?.count} loading={!d} hint={d ? `As of ${formatDate(d.asOf)}` : " "} />
            <StatTile label="Overdue" value={d?.overdue} loading={!d} hint={d && d.count ? `${Math.round((d.overdue / d.count) * 100)}% of loans` : " "} hintTone={d?.overdue ? "bad" : undefined} />
          </StatTiles>
          <DataTable rows={d?.loans} rowKey={r => r.loanId} columns={loanColumns(m)} {...tableProps} empty={empty("No books on loan")} />
        </>
      );
    }
    case "overdue": {
      const d = data as Overdue | undefined;
      return (
        <>
          <StatTiles>
            <StatTile label="Overdue" value={d?.count} loading={!d} hint={d ? `As of ${formatDate(d.asOf)}` : " "} hintTone={d?.count ? "bad" : undefined} />
            <StatTile label="Late fines so far" value={d && money(d.finesAccrued)} loading={!d} hint="Still growing while the books are out" />
          </StatTiles>
          <DataTable rows={d?.loans} rowKey={r => r.loanId} columns={loanColumns(m)} {...tableProps} empty={empty("Nothing is overdue")} />
        </>
      );
    }
    case "fines-collected": {
      const d = data as FinesCollected | undefined;
      const methods = d ? (Object.entries(d.byMethod) as [FineMethod, number][]) : [];
      return (
        <>
          <StatTiles>
            <StatTile label="Collected" value={d && money(d.collected)} loading={!d} hint="Cash, UPI and card (credit is not new money)" />
            <StatTile label="Waived" value={d && money(d.waived)} loading={!d} hint={d ? `${d.waivers} waiver${d.waivers === 1 ? "" : "s"}` : " "} />
            <StatTile label="Payments" value={d?.payments.length} loading={!d} hint={d ? `${formatDate(d.from)} – ${formatDate(d.to)}` : " "} />
          </StatTiles>
          {d && methods.length > 0 && (
            <Card title="By method">
              <BarList
                ariaLabel="Fines collected by method"
                formatValue={v => money(v)}
                items={methods.map(([k, v]) => ({ key: k, label: FINE_METHOD_LABELS[k] + (k === "LIBRARY_CREDIT" ? " (not cash)" : ""), value: v }))}
              />
            </Card>
          )}
          <DataTable
            rows={d?.payments}
            rowKey={p => p.id}
            {...tableProps}
            empty={empty("No payments in this period")}
            columns={[
              { key: "paidOn", header: "Date", render: p => <span className="nowrap">{formatDate(p.paidOn)}</span> },
              { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber}</span> },
              { key: "borrower", header: "Borrower", render: p => <Link to={`/library/borrowers/${p.borrowerUserId}`}>{p.borrower}</Link> },
              { key: "className", header: "Class", render: p => p.className || <span className="muted">—</span> },
              { key: "title", header: "For", render: p => p.title },
              { key: "method", header: "Method", render: p => FINE_METHOD_LABELS[p.method] },
              { key: "amount", header: "Amount", align: "right", render: p => <span className="num">{money(p.amount)}</span> }
            ]}
          />
        </>
      );
    }
    case "fines-outstanding": {
      const d = data as FinesOutstanding | undefined;
      return (
        <>
          <StatTiles>
            <StatTile label="Outstanding" value={d && money(d.total)} loading={!d} hint={d ? `As of ${formatDate(d.asOf)}, late fines so far included` : " "} hintTone={d?.total ? "warn" : undefined} />
            <StatTile label="Borrowers owing" value={d?.borrowers.length} loading={!d} hint=" " />
          </StatTiles>
          <DataTable
            rows={d?.borrowers}
            rowKey={b => b.borrowerUserId}
            {...tableProps}
            empty={empty("Nobody owes a fine")}
            columns={[
              { key: "borrower", header: "Borrower", render: b => <Link to={`/library/borrowers/${b.borrowerUserId}`}>{b.borrower}</Link> },
              { key: "role", header: "Role", render: b => <RoleBadge role={b.role} /> },
              { key: "className", header: "Class", render: b => b.className || <span className="muted">—</span> },
              { key: "loans", header: "Loans", align: "right", render: b => <span className="num">{b.loans}</span> },
              { key: "outstanding", header: "Outstanding", align: "right", render: b => <strong className="num">{money(b.outstanding)}</strong> }
            ]}
          />
        </>
      );
    }
    case "most-borrowed": {
      const d = data as MostBorrowed | undefined;
      return (
        <>
          <Card title="Loans per title" subtitle={d ? `${formatDate(d.from)} – ${formatDate(d.to)}` : undefined}>
            {d ? (
              <BarList
                ariaLabel="Loans per title"
                items={d.titles.map(t => ({ key: t.bookId, label: t.title, value: t.loans, note: `${t.borrowers} different borrower${t.borrowers === 1 ? "" : "s"}`, to: `/library/books/${t.bookId}` }))}
                empty="Nothing was borrowed in this period"
              />
            ) : (
              <div className="skeleton" style={{ height: 160 }} />
            )}
          </Card>
          <DataTable
            rows={d?.titles}
            rowKey={t => t.bookId}
            {...tableProps}
            empty={empty("Nothing was borrowed in this period")}
            columns={[
              { key: "title", header: "Title", render: t => <Link to={`/library/books/${t.bookId}`}>{t.title}</Link> },
              { key: "authors", header: "Authors" },
              { key: "category", header: "Category", render: t => t.category ?? <span className="muted">—</span> },
              { key: "loans", header: "Loans", align: "right", render: t => <span className="num">{t.loans}</span> },
              { key: "borrowers", header: "Borrowers", align: "right", render: t => <span className="num">{t.borrowers}</span> }
            ]}
          />
        </>
      );
    }
    case "inactive-borrowers": {
      const d = data as Inactive | undefined;
      return (
        <>
          <StatTiles>
            <StatTile label="Inactive borrowers" value={d?.count} loading={!d} hint={d ? `No loan since ${formatDate(d.since)}` : " "} />
          </StatTiles>
          <DataTable
            rows={d?.borrowers}
            rowKey={b => b.userId}
            {...tableProps}
            empty={empty("Everyone has borrowed since then")}
            columns={[
              { key: "name", header: "Name", render: b => <Link to={`/library/borrowers/${b.userId}`}>{b.name}</Link> },
              { key: "role", header: "Role", render: b => <RoleBadge role={b.role} /> },
              { key: "className", header: "Class", render: b => b.className || <span className="muted">—</span> },
              { key: "lastIssuedOn", header: "Last borrowed", render: b => (b.lastIssuedOn ? formatDate(b.lastIssuedOn) : <span className="muted">Never</span>) },
              { key: "loansEver", header: "Loans ever", align: "right", render: b => <span className="num">{b.loansEver}</span> }
            ]}
          />
        </>
      );
    }
    case "acquisitions": {
      const d = data as Acquisitions | undefined;
      return (
        <>
          <StatTiles>
            <StatTile label="Copies added" value={d?.count} loading={!d} hint={d ? `${formatDate(d.from)} – ${formatDate(d.to)}` : " "} />
            <StatTile label="Total value" value={d && money(d.totalValue)} loading={!d} hint="Copies without a price count as 0" />
          </StatTiles>
          <DataTable
            rows={d?.copies}
            rowKey={c => c.id}
            {...tableProps}
            empty={empty("No copies were added in this period")}
            columns={[
              { key: "acquiredOn", header: "Acquired", render: c => <span className="nowrap">{formatDate(c.acquiredOn)}</span> },
              { key: "accessionNumber", header: "Copy", render: c => <span className="mono">{c.accessionNumber}</span> },
              { key: "title", header: "Title" },
              { key: "authors", header: "Authors" },
              { key: "itemType", header: "Type", render: c => ITEM_TYPE_LABELS[c.itemType] },
              { key: "source", header: "Source", render: c => c.source ?? <span className="muted">—</span> },
              { key: "price", header: "Price", align: "right", render: c => (c.price === null ? <span className="muted">—</span> : <span className="num">{money(c.price)}</span>) },
              { key: "status", header: "Status", render: c => <CopyStatusBadge status={c.status} /> }
            ]}
          />
        </>
      );
    }
  }
}
