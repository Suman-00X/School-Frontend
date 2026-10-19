import { useState } from "react";
import { BookMarked, BookOpen, Plus, Wallet } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Kpi,
  Page,
  PageHeader,
  Select,
  SkeletonBlock,
  Tabs,
  useConfirm,
  useToast,
  type Column
} from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { ordinal } from "../../shared/utils/time";
import {
  HOLD_STATUS_LABELS,
  HOLD_STATUS_TONES,
  LOAN_STATUS_LABELS,
  MY_FINES_PATH,
  MY_HOLDS_PATH,
  MY_LOANS_PATH,
  cancelHold,
  useMyLibraryAccounts,
  type Hold,
  type LibraryAccount,
  type Loan
} from "../api/library";
import { ReserveDrawer } from "../components/ReserveDrawer";
import "../../shared/portal.css";

const TABS = [
  { id: "loans", label: "Loans" },
  { id: "holds", label: "Reservations" },
  { id: "fines", label: "Fines" }
];

const LOAN_VIEWS = [
  { value: "out", label: "On loan" },
  { value: "overdue", label: "Overdue" },
  { value: "all", label: "History" }
];
const HOLD_VIEWS = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" }
];

/* PO-07 · Library: your loans, reservations and fines (a parent: their children's, with a
   filter by child). Fines are paid at the library desk. */
export default function MyLibraryPage() {
  const { me, can } = useAuth();
  const accounts = useMyLibraryAccounts();
  const { params, setParams, setPage } = useListParams({ tab: "loans", loans: "out", holds: "open", who: "" });
  const tab = TABS.some(t => t.id === params.tab) ? params.tab : "loans";

  /* A parent's library is their children's: then rows are tagged and can be filtered by child */
  const others = (accounts.data ?? []).filter(a => a.borrower.id !== me?.account.id);
  const forFamily = others.length > 0;
  const kids = others.map(a => ({ id: a.borrower.id, name: a.borrower.name }));
  const who = forFamily && kids.some(k => k.id === params.who) ? params.who : "";

  return (
    <Page>
      <PageHeader title="Library" subtitle={forFamily ? "Your children's loans, reservations and fines" : "Your loans, reservations and fines"} />
      <Card flush>
        <div className="row-between" style={{ padding: "0 14px", flexWrap: "wrap" }}>
          <Tabs tabs={TABS} value={tab} onChange={id => setParams({ tab: id })} />
        </div>
        {(tab !== "fines" || forFamily) && (
        <div className="filter-bar">
          {tab === "loans" && <Select label="Show" className="select-sm" required value={params.loans} options={LOAN_VIEWS} onChange={e => setParams({ loans: e.target.value })} />}
          {tab === "holds" && <Select label="Show" className="select-sm" required value={params.holds} options={HOLD_VIEWS} onChange={e => setParams({ holds: e.target.value })} />}
          {forFamily && (
            <Select label="Child" className="select-sm" value={who} placeholder="All children" options={kids.map(k => ({ value: k.id, label: k.name }))} onChange={e => setParams({ who: e.target.value })} />
          )}
        </div>
        )}
        {tab === "loans" && <LoansTab view={params.loans} who={who} forFamily={forFamily} page={params.page} onPage={setPage} />}
        {tab === "holds" && <HoldsTab view={params.holds} who={who} forFamily={forFamily} kids={kids} page={params.page} onPage={setPage} canReserve={can("library.holds.own")} />}
        {tab === "fines" && <FinesTab accounts={accounts.data} error={accounts.error} onRetry={() => void accounts.refetch()} who={who} forFamily={forFamily} />}
      </Card>
    </Page>
  );
}

/* With a child picked, the rows are filtered here (the API has no borrower filter for self-service):
   one page of 100, no paging */
function useOwnList<T extends { borrowerUserId: string }>(path: string, query: Record<string, string | number | boolean | undefined>, who: string, page: number) {
  const list = useApiList<T>(path, who ? { ...query, limit: 100 } : { ...query, page, limit: 20 });
  return { ...list, rows: who ? list.rows?.filter(r => r.borrowerUserId === who) : list.rows, meta: who ? undefined : list.meta };
}

function LoansTab({ view, who, forFamily, page, onPage }: { view: string; who: string; forFamily: boolean; page: number; onPage: (p: number) => void }) {
  const currency = useSchoolCurrency();
  const query = view === "out" ? { status: "ISSUED" } : view === "overdue" ? { overdue: true } : {};
  const list = useOwnList<Loan>(MY_LOANS_PATH, query, who, page);

  const columns: Column<Loan>[] = [
    {
      key: "title",
      header: "Book",
      render: l => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 550 }}>{l.book.title}</div>
          <div className="small muted">{l.book.authors.join(", ")}</div>
        </div>
      )
    },
    ...(forFamily && !who ? [{ key: "borrower", header: "For", render: (l: Loan) => l.borrower.name }] : []),
    { key: "copy", header: "Copy", render: l => <span className="mono">{l.copy?.accessionNumber ?? "—"}</span> },
    { key: "issuedOn", header: "Issued", render: l => <span className="nowrap">{formatDate(l.issuedOn)}</span> },
    {
      key: "dueDate",
      header: "Due",
      render: l =>
        l.status === "ISSUED" ? (
          <div className="nowrap">
            <span className={l.isOverdue ? "po-danger" : undefined}>{formatDate(l.dueDate)}</span>
            {l.isOverdue && <div className="small po-danger">{l.daysOverdue === 1 ? "1 day overdue" : `${l.daysOverdue} days overdue`}</div>}
          </div>
        ) : (
          <span className="muted nowrap">{formatDate(l.dueDate)}</span>
        )
    },
    {
      key: "returnedOn",
      header: "Returned",
      render: l => (l.returnedOn ? <span className="nowrap">{formatDate(l.returnedOn)}</span> : l.status === "LOST" ? <Badge tone="danger">{LOAN_STATUS_LABELS.LOST}</Badge> : <span className="muted">—</span>)
    },
    {
      key: "fine",
      header: "Fine",
      align: "right",
      render: l =>
        l.fineOutstanding > 0 ? (
          <div className="po-num">
            {formatMoney(l.fineOutstanding, currency)}
            {!l.fineIsFinal && <div className="small muted">still growing</div>}
          </div>
        ) : (
          <span className="muted">—</span>
        )
    }
  ];

  return (
    <DataTable
      rows={list.rows}
      rowKey={l => l.id}
      loading={list.isLoading}
      error={list.error}
      onRetry={() => void list.refetch()}
      columns={columns}
      meta={list.meta}
      onPageChange={onPage}
      empty={
        <EmptyState
          icon={<BookOpen />}
          title={view === "overdue" ? "Nothing overdue" : view === "out" ? "No books on loan" : "No loans yet"}
          message={view === "all" ? "Books borrowed from the library show here." : undefined}
        />
      }
    />
  );
}

function HoldsTab({
  view,
  who,
  forFamily,
  kids,
  page,
  onPage,
  canReserve
}: {
  view: string;
  who: string;
  forFamily: boolean;
  kids: { id: string; name: string }[];
  page: number;
  onPage: (p: number) => void;
  canReserve: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const list = useOwnList<Hold>(MY_HOLDS_PATH, view === "open" ? { open: true } : {}, who, page);
  const cancel = useApiMutation(cancelHold, { invalidate: [MY_HOLDS_PATH, MY_FINES_PATH] });
  const [reserving, setReserving] = useState(false);

  const askCancel = async (h: Hold) => {
    const ok = await confirm({
      title: `Cancel the reservation of ${h.book.title}?`,
      message: forFamily ? `${h.borrower.name} loses their place in the queue.` : "You lose your place in the queue.",
      confirmLabel: "Cancel reservation"
    });
    if (ok) cancel.mutate(h.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const queue = (h: Hold) => {
    if (h.status === "READY") return h.pickupBy ? <span className="po-success">Collect by {formatDate(h.pickupBy)}</span> : <span className="po-success">Ready</span>;
    if (h.status !== "WAITING" || !h.queuePosition) return <span className="muted">—</span>;
    return forFamily ? `${ordinal(h.queuePosition)} in line` : h.queuePosition === 1 ? "You are next in line" : `You are ${ordinal(h.queuePosition)} in line`;
  };

  const columns: Column<Hold>[] = [
    {
      key: "title",
      header: "Book",
      render: h => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 550 }}>{h.book.title}</div>
          <div className="small muted">{h.book.authors.join(", ")}</div>
        </div>
      )
    },
    ...(forFamily && !who ? [{ key: "borrower", header: "For", render: (h: Hold) => h.borrower.name }] : []),
    {
      key: "status",
      header: "Status",
      render: h => (
        <Badge tone={HOLD_STATUS_TONES[h.status]} dot>
          {HOLD_STATUS_LABELS[h.status]}
        </Badge>
      )
    },
    { key: "queue", header: "Queue", render: queue },
    { key: "requestedAt", header: "Reserved", render: h => <span className="nowrap">{formatDate(h.requestedAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 90,
      render: h =>
        canReserve && (h.status === "WAITING" || h.status === "READY") ? (
          <Button size="sm" variant="ghost" onClick={() => void askCancel(h)} loading={cancel.isPending && cancel.variables === h.id}>
            Cancel
          </Button>
        ) : null
    }
  ];

  return (
    <>
      {canReserve && (
        <div className="row-between" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <span className="small muted">Reserve a book that is out, and the library keeps the next copy for you.</span>
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setReserving(true)}>
            Reserve a book
          </Button>
        </div>
      )}
      <DataTable
        rows={list.rows}
        rowKey={h => h.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        columns={columns}
        meta={list.meta}
        onPageChange={onPage}
        empty={<EmptyState icon={<BookMarked />} title={view === "open" ? "No open reservations" : "No reservations yet"} />}
      />
      <ReserveDrawer open={reserving} onClose={() => setReserving(false)} kids={forFamily ? kids : []} defaultBorrower={who || undefined} />
    </>
  );
}

function FinesTab({ accounts, error, onRetry, who, forFamily }: { accounts: LibraryAccount[] | undefined; error: unknown; onRetry: () => void; who: string; forFamily: boolean }) {
  const currency = useSchoolCurrency();
  const money = (n: number) => formatMoney(n, currency);
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!accounts)
    return (
      <div className="card-body">
        <SkeletonBlock lines={6} />
      </div>
    );
  const shown = accounts.filter(a => (who ? a.borrower.id === who : true));
  if (!shown.length) return <EmptyState icon={<Wallet />} title="No library account yet" />;

  return (
    <div className="card-body stack">
      {shown.map(a => (
        <section key={a.borrower.id} className="stack-sm">
          {forFamily && <h3>{a.borrower.name}</h3>}
          <div className="kpis">
            <Kpi label="Fines due" value={<span className={a.finesOutstanding > 0 ? "po-danger" : undefined}>{money(a.finesOutstanding)}</span>} hint="Paid at the library desk" />
            <Kpi label="Credit" value={money(a.credit)} />
            <Kpi label="Books out" value={a.openLoans} />
            <Kpi label="Overdue" value={<span className={a.overdueLoans > 0 ? "po-danger" : undefined}>{a.overdueLoans}</span>} />
          </div>
          {!a.canBorrow && (
            <Alert tone="warning" title="Borrowing is paused">
              {a.blocks.map(b => (
                <div key={b.reason}>{b.message}.</div>
              ))}
            </Alert>
          )}
          {a.loansWithFines.length > 0 && (
            <DataTable
              rows={a.loansWithFines}
              rowKey={l => l.loanId}
              columns={[
                { key: "title", header: "Book", render: l => l.title },
                { key: "dueDate", header: "Due", render: l => <span className="nowrap">{formatDate(l.dueDate)}</span> },
                {
                  key: "charges",
                  header: "Charges",
                  render: l =>
                    [l.lateFine && `Late ${money(l.lateFine)}`, l.lostCharge && `Lost ${money(l.lostCharge)}`, l.damageCharge && `Damage ${money(l.damageCharge)}`].filter(Boolean).join(" · ") || "—"
                },
                { key: "paid", header: "Paid or waived", align: "right", render: l => <span className="po-num">{money(l.finePaid + l.fineWaived)}</span> },
                { key: "due", header: "Due now", align: "right", render: l => <strong className="po-num">{money(l.fineOutstanding)}</strong> }
              ]}
            />
          )}
          {a.payments.length > 0 && (
            <DataTable
              rows={a.payments}
              rowKey={p => p.id}
              columns={[
                { key: "paidAt", header: "Paid", render: p => <span className="nowrap">{formatDate(p.paidAt)}</span> },
                { key: "title", header: "For", render: p => p.title },
                { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber}</span> },
                { key: "amount", header: "Amount", align: "right", render: p => <span className="po-num">{money(p.amount)}</span> }
              ]}
            />
          )}
          {!a.loansWithFines.length && !a.payments.length && <p className="muted">No fines. Thank you for returning books on time.</p>}
        </section>
      ))}
    </div>
  );
}
