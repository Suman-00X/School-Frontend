/* LB-03 · Catalogue (staff view): one title with its copies, loans and holds */
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookmarkPlus, CopyPlus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { useApiList, useListParams } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  Page,
  RoleBadge,
  Select,
  SkeletonBlock,
  useConfirm,
  useTabParam,
  useToast,
  type TabItem
} from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { Book, Copy, Hold, Loan } from "../../shared/api/types";
import { CopyStatusBadge, HoldStatusBadge, ItemTypeBadge, LoanStatusBadge, StatChips } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { COPY_STATUS_LABELS, COPY_STATUSES, ITEM_TYPE_LABELS, ordinal } from "../../shared/utils/labels";
import { AddCopiesDialog } from "../../copies/components/AddCopiesDialog";
import { CopyDrawer } from "../../copies/components/CopyDrawer";
import { HOLDS_PATH } from "../../holds/api/holds";
import { PlaceHoldDialog } from "../../holds/components/HoldDialogs";
import { HoldDrawer } from "../../holds/components/HoldDrawer";
import { LOANS_PATH } from "../../loans/api/loans";
import { FineAmount } from "../../loans/components/LoanActions";
import { LoanDrawer } from "../../loans/components/LoanDrawer";
import { useBook, useDeleteBook } from "../api/books";
import { BookDrawer } from "../components/BookDrawer";

export default function BookDetailPage() {
  const { bookId = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const book = useBook(bookId);
  const remove = useDeleteBook();
  const [editing, setEditing] = useState(false);
  const b = book.data;

  const tabs: TabItem[] = [
    { id: "copies", label: "Copies", hidden: !can("library.copies.read") },
    { id: "loans", label: "Loans", hidden: !can("library.loans.read") },
    { id: "holds", label: "Holds", hidden: !can("library.holds.read") },
    { id: "details", label: "Details" },
    { id: "history", label: "History", hidden: !can("library.activity.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const header = (
    <DrillHeader
      back="/library/books"
      backLabel="Back to the catalogue"
      title={
        <span style={{ display: "inline-block", width: "min(280px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={b?.title}>
          {b?.title ?? "Book"}
        </span>
      }
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (book.error)
    return (
      <Page>
        {header}
        <ErrorState error={book.error} onRetry={() => void book.refetch()} />
      </Page>
    );

  const askRemove = async () => {
    if (!b) return;
    const ok = await confirm({
      title: `Remove ${b.title}?`,
      message: `The title and its ${b.copies.total} cop${b.copies.total === 1 ? "y" : "ies"} leave the catalogue. Loan history is kept. A book with copies on loan or open holds can't be removed.`,
      confirmLabel: "Remove book"
    });
    if (ok)
      remove.mutate(b.id, {
        onSuccess: res => {
          toast.success(res.message || `${b.title} removed`);
          navigate("/library/books");
        },
        onError: err => toast.error(err)
      });
  };

  return (
    <Page>
      {header}
      <BookHeader
        book={b}
        actions={
          can("library.books.manage") && (
            <>
              <Button icon={<Pencil />} onClick={() => setEditing(true)} disabled={!b}>
                Edit
              </Button>
              <Button variant="ghost" icon={<Trash2 />} onClick={() => void askRemove()} loading={remove.isPending} disabled={!b} aria-label="Remove book" title="Remove book" />
            </>
          )
        }
      />
      {!b ? (
        <SkeletonBlock lines={6} />
      ) : (
        <>
          {tab === "copies" && <CopiesTab book={b} />}
          {tab === "loans" && <LoansTab bookId={b.id} />}
          {tab === "holds" && <HoldsTab book={b} />}
          {tab === "details" && <DetailsCard book={b} />}
          {tab === "history" && <ActivityLog basePath="/library/activity" module="library" fixed={{ entityId: b.id }} compact title="History" />}
        </>
      )}
      {b && <BookDrawer open={editing} book={b} onClose={() => setEditing(false)} />}
    </Page>
  );
}

function BookHeader({ book: b, actions }: { book: Book | undefined; actions?: ReactNode }) {
  const sub = b ? [b.authors.join(", "), b.publisher, b.publishedYear].filter(Boolean).join(" · ") : "";
  const extra = b
    ? ([
        b.copies.lost && { label: "Lost", value: b.copies.lost, tone: "danger" as const },
        b.copies.damaged && { label: "Damaged", value: b.copies.damaged, tone: "warning" as const },
        b.copies.missing && { label: "Missing", value: b.copies.missing, tone: "danger" as const },
        b.copies.withdrawn && { label: "Withdrawn", value: b.copies.withdrawn }
      ].filter(Boolean) as { label: string; value: number; tone?: "danger" | "warning" }[])
    : [];
  return (
    <Card>
      <div className="lib-header">
        <div className="lib-header-main">
          <div className="lib-header-sub" title={sub}>
            {b ? sub || <span className="muted">No author recorded</span> : <span className="skeleton" style={{ display: "inline-block", width: 220, height: 14 }} />}
          </div>
          <div className="row" style={{ gap: 8, minHeight: 24 }}>
            {b && (
              <>
                <ItemTypeBadge type={b.itemType} />
                {b.category && <Badge>{b.category}</Badge>}
                {b.shelfLocation && <Badge tone="info">Shelf {b.shelfLocation}</Badge>}
                {b.isbn && <span className="mono small muted">ISBN {b.isbn}</span>}
              </>
            )}
          </div>
          <StatChips
            items={[
              { label: "Copies", value: b ? b.copies.total : "–" },
              { label: "Available", value: b ? b.copies.available : "–", tone: b && b.copies.total && !b.copies.available ? "warning" : undefined },
              { label: "On loan", value: b ? b.copies.issued : "–" },
              { label: "Held", value: b ? b.copies.onHold : "–" },
              { label: "Waiting", value: b ? b.holdsWaiting : "–" },
              ...extra
            ]}
          />
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </Card>
  );
}

function DetailsCard({ book: b }: { book: Book }) {
  return (
    <Card title="Details">
      <DescriptionList
        columns={3}
        items={[
          { label: "Title", value: b.title },
          { label: "Subtitle", value: b.subtitle },
          { label: "Authors", value: b.authors.join(", ") },
          { label: "ISBN", value: b.isbn && <span className="mono">{b.isbn}</span> },
          { label: "Item type", value: ITEM_TYPE_LABELS[b.itemType] },
          { label: "Category", value: b.category },
          { label: "Subject", value: b.subject?.subjectName },
          { label: "Shelf", value: b.shelfLocation },
          { label: "Language", value: b.language },
          { label: "Publisher", value: b.publisher },
          { label: "Year", value: b.publishedYear },
          { label: "Edition", value: b.edition },
          { label: "Description", value: b.description, wide: true },
          { label: "Staff notes", value: b.internalNotes, wide: true }
        ]}
      />
    </Card>
  );
}

function CopiesTab({ book }: { book: Book }) {
  const { can } = useAuth();
  const money = useMoney();
  const { params, setParam, setPage } = useListParams({ status: "" });
  const list = useApiList<Copy>(`/library/books/${book.id}/copies`, params);
  const [adding, setAdding] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const addButton = can("library.copies.manage") && (
    <Button size="sm" variant="primary" icon={<CopyPlus />} onClick={() => setAdding(true)}>
      Add copies
    </Button>
  );
  return (
    <Card flush title="Copies" subtitle="A copy leaves the collection as Withdrawn; none is ever deleted" actions={addButton}>
      <div className="filter-bar">
        <Select
          label="Status"
          className="select-sm"
          value={params.status}
          onChange={e => setParam("status", e.target.value)}
          placeholder="Any status"
          options={COPY_STATUSES.map(s => ({ value: s, label: COPY_STATUS_LABELS[s] }))}
        />
      </div>
      <DataTable
        rows={list.rows}
        rowKey={c => c.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={c => setCopyId(c.id)}
        empty={params.status ? <EmptyState title="No copy has this status" /> : <EmptyState title="No copies yet" message="Add copies to lend this title." actions={addButton} />}
        columns={[
          { key: "accessionNumber", header: "Accession no.", render: c => <span className="mono">{c.accessionNumber}</span> },
          { key: "barcode", header: "Barcode", render: c => (c.barcode ? <span className="mono small">{c.barcode}</span> : <span className="muted">—</span>) },
          { key: "status", header: "Status", render: c => <CopyStatusBadge status={c.status} /> },
          { key: "itemType", header: "Type", render: c => (c.itemType ? <ItemTypeBadge type={c.itemType} /> : <span className="muted">As the book</span>) },
          { key: "price", header: "Price", align: "right", render: c => (c.price === null ? <span className="muted">—</span> : <span className="num">{money(c.price)}</span>) },
          { key: "acquiredOn", header: "Acquired", render: c => (c.acquiredOn ? <span className="nowrap">{formatDate(c.acquiredOn)}</span> : <span className="muted">—</span>) },
          { key: "source", header: "Source", render: c => c.source || <span className="muted">—</span> },
          { key: "conditionNotes", header: "Condition", render: c => (c.conditionNotes ? <span className="small">{c.conditionNotes}</span> : <span className="muted">—</span>) }
        ]}
      />
      <AddCopiesDialog open={adding} book={book} onClose={() => setAdding(false)} />
      <CopyDrawer copyId={copyId} onClose={() => setCopyId(null)} showBook={false} />
    </Card>
  );
}

function LoansTab({ bookId }: { bookId: string }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<Loan>(LOANS_PATH, { bookId, page: params.page, limit: params.limit });
  const [loanId, setLoanId] = useState<string | null>(null);
  return (
    <Card flush title="Loans" subtitle="Everyone who borrowed this title, newest first">
      <DataTable
        rows={list.rows}
        rowKey={l => l.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={l => setLoanId(l.id)}
        empty={<EmptyState title="Never borrowed yet" />}
        columns={[
          { key: "copy", header: "Copy", render: l => <span className="mono">{l.copy.accessionNumber}</span> },
          {
            key: "borrower",
            header: "Borrower",
            render: l => (
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                {l.borrower.name} <RoleBadge role={l.borrowerRole} />
              </span>
            )
          },
          { key: "issuedOn", header: "Issued", render: l => <span className="nowrap">{formatDate(l.issuedOn)}</span> },
          { key: "dueDate", header: "Due", render: l => <span className={`nowrap${l.isOverdue ? " text-danger" : ""}`}>{formatDate(l.dueDate)}</span> },
          { key: "returnedOn", header: "Returned", render: l => (l.returnedOn ? <span className="nowrap">{formatDate(l.returnedOn)}</span> : <span className="muted">—</span>) },
          { key: "status", header: "Status", render: l => <LoanStatusBadge status={l.status} overdue={l.isOverdue} /> },
          { key: "fineOutstanding", header: "Outstanding", align: "right", render: l => <FineAmount loan={l} value={l.fineOutstanding} /> }
        ]}
      />
      <LoanDrawer loanId={loanId} onClose={() => setLoanId(null)} />
    </Card>
  );
}

function HoldsTab({ book }: { book: Book }) {
  const { can } = useAuth();
  const list = useApiList<Hold>(HOLDS_PATH, { bookId: book.id, open: "true", limit: 50 });
  const [holdId, setHoldId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const placeButton = can("library.holds.manage") && book.itemType !== "REFERENCE" && (
    <Button size="sm" variant="primary" icon={<BookmarkPlus />} onClick={() => setPlacing(true)}>
      Place hold
    </Button>
  );
  return (
    <Card flush title="Open holds" subtitle="Readers waiting for this title, in queue order" actions={placeButton}>
      <DataTable
        rows={list.rows}
        rowKey={h => h.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        onRowClick={h => setHoldId(h.id)}
        empty={<EmptyState title="Nobody is waiting for this book" actions={placeButton} />}
        columns={[
          {
            key: "borrower",
            header: "For",
            render: h => (
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                {h.borrower.name} <RoleBadge role={h.borrower.role} />
              </span>
            )
          },
          { key: "status", header: "Status", render: h => <HoldStatusBadge status={h.status} /> },
          {
            key: "where",
            header: "",
            render: h =>
              h.status === "READY" && h.copy ? (
                <span>
                  Copy <span className="mono">{h.copy.accessionNumber}</span> kept until {formatDate(h.pickupBy)}
                </span>
              ) : h.queuePosition ? (
                `${ordinal(h.queuePosition)} in line`
              ) : null
          },
          { key: "requestedAt", header: "Requested", render: h => <span className="nowrap">{formatDate(h.requestedAt)}</span> }
        ]}
      />
      <HoldDrawer holdId={holdId} onClose={() => setHoldId(null)} />
      <PlaceHoldDialog open={placing} onClose={() => setPlacing(false)} bookId={book.id} />
    </Card>
  );
}
