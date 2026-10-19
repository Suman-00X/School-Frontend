/* LB-06 · Holds: ready for pickup, waiting, all; place and cancel at the desk */
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Bookmark, BookmarkPlus, ScanBarcode, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, ButtonLink, Card, DataTable, EmptyState, Page, RoleBadge, Select, Tabs, type Column } from "@/common/ui";
import { formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import type { Hold } from "../../shared/api/types";
import { BookSelect, BorrowerSelect, HoldStatusBadge, LibraryIntro } from "../../shared/components/LibraryBits";
import { HOLD_STATUS_LABELS, HOLD_STATUSES, ordinal } from "../../shared/utils/labels";
import { HOLDS_PATH } from "../api/holds";
import { CancelHoldDialog, PlaceHoldDialog } from "../components/HoldDialogs";
import { HoldDrawer, issueLink } from "../components/HoldDrawer";

const VIEWS = [
  { id: "ready", label: "Ready for pickup" },
  { id: "waiting", label: "Waiting" },
  { id: "all", label: "All" }
];

export default function HoldsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { holdId } = useParams();
  const { params, setParams, setParam, setPage } = useListParams({ view: "ready", status: "", bookId: "", borrowerUserId: "" });
  const view = VIEWS.some(v => v.id === params.view) ? params.view : "ready";
  const status = view === "ready" ? "READY" : view === "waiting" ? "WAITING" : params.status;
  const list = useApiList<Hold>(HOLDS_PATH, { status, bookId: params.bookId, borrowerUserId: params.borrowerUserId, page: params.page, limit: params.limit });
  const [placing, setPlacing] = useState(false);
  const [cancelling, setCancelling] = useState<Hold | null>(null);
  const today = todayIso();
  const canManage = can("library.holds.manage");
  const canIssue = can("library.loans.circulate");
  const known = (list.rows ?? []).map(h => ({ userId: h.borrowerUserId, name: h.borrower.name, role: h.borrower.role }));

  /* Ready holds: the soonest pickup first (on this page) */
  const rows = view === "ready" && list.rows ? [...list.rows].sort((a, b) => (a.pickupBy ?? "").localeCompare(b.pickupBy ?? "")) : list.rows;
  const openHold = (id: string | null) => navigate({ pathname: id ? `/library/holds/${id}` : "/library/holds", search }, { replace: !!holdId });

  const actions = (h: Hold) => {
    const isOpen = h.status === "WAITING" || h.status === "READY";
    if (!isOpen) return null;
    return (
      <div className="row-actions" onClick={e => e.stopPropagation()}>
        {h.status === "READY" && canIssue && (
          <ButtonLink size="sm" variant="ghost" icon={<ScanBarcode />} to={issueLink(h)}>
            Issue
          </ButtonLink>
        )}
        {canManage && <Button size="sm" variant="ghost" icon={<X />} onClick={() => setCancelling(h)} aria-label={`Cancel ${h.borrower.name}'s hold`} title="Cancel hold" />}
      </div>
    );
  };

  const columns: (Column<Hold> | false)[] = [
    {
      key: "book",
      header: "Book",
      render: h => (
        <div style={{ minWidth: 0, maxWidth: 280 }}>
          <div className="person-name" title={h.book.title}>
            {h.book.title}
          </div>
          <div className="person-sub">{h.book.authors.join(", ")}</div>
        </div>
      )
    },
    {
      key: "borrower",
      header: "For",
      render: h => (
        <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          {h.borrower.name} <RoleBadge role={h.borrower.role} />
        </span>
      )
    },
    view === "all" && { key: "status", header: "Status", render: h => <HoldStatusBadge status={h.status} /> },
    view !== "ready" && {
      key: "queue",
      header: "In line",
      render: h => (h.status === "WAITING" && h.queuePosition ? ordinal(h.queuePosition) : <span className="muted">—</span>)
    },
    view !== "ready" && { key: "requestedAt", header: "Requested", render: h => <span className="nowrap">{formatDateTime(h.requestedAt)}</span> },
    view !== "ready" && { key: "notNeededAfter", header: "Not needed after", render: h => (h.notNeededAfter ? formatDate(h.notNeededAfter) : <span className="muted">—</span>) },
    view !== "waiting" && {
      key: "shelf",
      header: "At the desk",
      render: h =>
        h.status === "READY" && h.copy ? (
          <span className={h.pickupBy && h.pickupBy <= today ? "text-danger" : undefined}>
            Copy <span className="mono">{h.copy.accessionNumber}</span> kept until {formatDate(h.pickupBy)}
            {h.pickupBy === today && " (today)"}
          </span>
        ) : (
          <span className="muted">—</span>
        )
    },
    { key: "actions", header: "", align: "right", width: 120, render: actions }
  ];

  const filtered = !!(params.bookId || params.borrowerUserId || (view === "all" && params.status));
  const placeButton = canManage && (
    <Button variant="primary" icon={<BookmarkPlus />} onClick={() => setPlacing(true)}>
      Place hold
    </Button>
  );

  return (
    <Page>
      <LibraryIntro actions={placeButton}>Uncollected holds expire each night and the copy moves on. Renewals are refused while others wait.</LibraryIntro>
      <Card flush>
        <div style={{ padding: "0 14px" }}>
          <Tabs tabs={VIEWS} value={view} onChange={id => setParams({ view: id, status: "" })} />
        </div>
        <div className="filter-bar">
          <BookSelect label="Book" className="select-sm" value={params.bookId} onChange={e => setParam("bookId", e.target.value)} placeholder="Any book" />
          <BorrowerSelect
            label="For"
            className="select-sm"
            value={params.borrowerUserId}
            onChange={e => setParam("borrowerUserId", e.target.value)}
            placeholder="Anyone"
            known={known}
          />
          <Select
            label="Status"
            className="select-sm"
            value={view === "all" ? params.status : ""}
            onChange={e => setParam("status", e.target.value)}
            placeholder={view === "all" ? "Any status" : HOLD_STATUS_LABELS[status as "READY" | "WAITING"]}
            disabled={view !== "all"}
            options={HOLD_STATUSES.map(s => ({ value: s, label: HOLD_STATUS_LABELS[s] }))}
          />
        </div>
        <DataTable
          columns={columns.filter(Boolean) as Column<Hold>[]}
          rows={rows}
          rowKey={h => h.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={h => openHold(h.id)}
          empty={
            filtered ? (
              <EmptyState icon={<Bookmark />} title="No hold matches these filters" />
            ) : view === "ready" ? (
              <EmptyState icon={<Bookmark />} title="Nothing waiting at the desk" message="When a held book comes back, its copy shows here until the reader collects it." />
            ) : view === "waiting" ? (
              <EmptyState icon={<Bookmark />} title="Nobody is waiting for a book" actions={placeButton} />
            ) : (
              <EmptyState icon={<Bookmark />} title="No holds yet" actions={placeButton} />
            )
          }
        />
      </Card>
      <HoldDrawer holdId={holdId ?? null} onClose={() => openHold(null)} />
      <PlaceHoldDialog open={placing} onClose={() => setPlacing(false)} />
      <CancelHoldDialog hold={cancelling} onClose={() => setCancelling(null)} />
    </Page>
  );
}
