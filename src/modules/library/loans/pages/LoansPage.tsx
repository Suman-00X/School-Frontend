/* LB-05 · Loans and fines: quick tabs over one table, a loan drawer, links to borrower accounts */
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen, ScanBarcode } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { ButtonLink, Card, DataTable, EmptyState, Page, RoleBadge, Select, Tabs, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { Loan } from "../../shared/api/types";
import { BookSelect, BorrowerSelect, LibraryIntro, LoanStatusBadge } from "../../shared/components/LibraryBits";
import { LOAN_STATUS_LABELS } from "../../shared/utils/labels";
import { LOANS_PATH } from "../api/loans";
import { FineAmount, useLoanActions } from "../components/LoanActions";
import { LoanDrawer } from "../components/LoanDrawer";
import { LoanRowMenu } from "../components/LoanRowMenu";

const VIEWS = [
  { id: "on-loan", label: "On loan" },
  { id: "overdue", label: "Overdue" },
  { id: "fines", label: "With fines" },
  { id: "all", label: "All" }
];

const queryFor = (view: string, status: string) =>
  view === "overdue" ? { overdue: "true" } : view === "fines" ? { withFine: "true" } : view === "all" ? { status } : { status: "ISSUED" };

export default function LoansPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { loanId } = useParams();
  const { params, setParams, setParam, setPage } = useListParams({ view: "on-loan", status: "", borrowerUserId: "", bookId: "" });
  const view = VIEWS.some(v => v.id === params.view) ? params.view : "on-loan";
  const list = useApiList<Loan>(LOANS_PATH, {
    ...queryFor(view, params.status),
    borrowerUserId: params.borrowerUserId,
    bookId: params.bookId,
    page: params.page,
    limit: params.limit
  });
  const { actionsFor, dialogs } = useLoanActions();
  const known = (list.rows ?? []).map(l => ({ userId: l.borrowerUserId, name: l.borrower.name, role: l.borrowerRole }));

  /* The drawer has its own URL (/library/loans/:loanId) and keeps the list's filters */
  const openLoan = (id: string | null) => navigate({ pathname: id ? `/library/loans/${id}` : "/library/loans", search }, { replace: !!loanId });

  const columns: Column<Loan>[] = [
    {
      key: "title",
      header: "Title",
      render: l => (
        <div style={{ minWidth: 0, maxWidth: 280 }}>
          <div className="person-name" title={l.book.title}>
            {l.book.title}
          </div>
          <div className="person-sub mono">{l.copy.accessionNumber}</div>
        </div>
      )
    },
    {
      key: "borrower",
      header: "Borrower",
      render: l =>
        can("library.loans.read") ? (
          <Link to={`/library/borrowers/${l.borrowerUserId}`} onClick={e => e.stopPropagation()}>
            {l.borrower.name}
          </Link>
        ) : (
          l.borrower.name
        )
    },
    { key: "role", header: "Role", render: l => <RoleBadge role={l.borrowerRole} /> },
    { key: "issuedOn", header: "Issued", render: l => <span className="nowrap">{formatDate(l.issuedOn)}</span> },
    {
      key: "dueDate",
      header: "Due",
      render: l => (
        <span className={`nowrap${l.isOverdue ? " text-danger" : ""}`}>
          {formatDate(l.dueDate)}
          {l.isOverdue && <div className="small">{l.daysOverdue} days late</div>}
        </span>
      )
    },
    { key: "status", header: "Status", render: l => <LoanStatusBadge status={l.status} overdue={l.isOverdue} /> },
    { key: "fineTotal", header: "Fine", align: "right", render: l => <FineAmount loan={l} value={l.fineTotal} /> },
    {
      key: "fineOutstanding",
      header: "Outstanding",
      align: "right",
      render: l => (l.fineOutstanding ? <strong className="num text-danger">{<FineAmount loan={l} value={l.fineOutstanding} />}</strong> : <span className="muted">—</span>)
    },
    { key: "actions", header: "", align: "right", width: 150, render: l => <LoanRowMenu actions={actionsFor(l)} label={l.book.title} /> }
  ];

  const filtered = !!(params.borrowerUserId || params.bookId || (view === "all" && params.status));
  const empty = filtered ? (
    <EmptyState icon={<BookOpen />} title="No loan matches these filters" />
  ) : view === "overdue" ? (
    <EmptyState icon={<BookOpen />} title="Nothing is overdue" message="Every book on loan is within its due date." />
  ) : view === "fines" ? (
    <EmptyState icon={<BookOpen />} title="No unpaid fines" />
  ) : (
    <EmptyState
      icon={<BookOpen />}
      title={view === "all" ? "No loans yet" : "No books on loan"}
      actions={
        can("library.loans.circulate") && (
          <ButtonLink variant="primary" icon={<ScanBarcode />} to="/library/desk">
            Issue a book
          </ButtonLink>
        )
      }
    />
  );

  return (
    <Page>
      <LibraryIntro
        actions={
          can("library.loans.circulate") && (
            <ButtonLink icon={<ScanBarcode />} to="/library/desk">
              Open the desk
            </ButtonLink>
          )
        }
      >
        Every loan with its fine as of today. Late fines grow daily while a book is out.
      </LibraryIntro>
      <Card flush>
        <div style={{ padding: "0 14px" }}>
          <Tabs tabs={VIEWS} value={view} onChange={id => setParams({ view: id, status: "" })} />
        </div>
        <div className="filter-bar">
          <BorrowerSelect
            label="Borrower"
            className="select-sm"
            value={params.borrowerUserId}
            onChange={e => setParam("borrowerUserId", e.target.value)}
            placeholder="Any borrower"
            known={known}
          />
          <BookSelect label="Book" className="select-sm" value={params.bookId} onChange={e => setParam("bookId", e.target.value)} placeholder="Any book" />
          <Select
            label="Status"
            className="select-sm"
            value={view === "all" ? params.status : ""}
            onChange={e => setParam("status", e.target.value)}
            placeholder={view === "all" ? "Any status" : VIEWS.find(v => v.id === view)?.label}
            disabled={view !== "all"}
            options={(["ISSUED", "RETURNED", "LOST"] as const).map(s => ({ value: s, label: LOAN_STATUS_LABELS[s] }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={l => l.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={l => openLoan(l.id)}
          empty={empty}
        />
      </Card>
      <LoanDrawer loanId={loanId ?? null} onClose={() => openLoan(null)} />
      {dialogs}
    </Page>
  );
}
