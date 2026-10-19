import { useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList } from "@/common/hooks";
import { Button, DataTable, DescriptionList, Drawer, ErrorState, SkeletonBlock, type Column } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { PhaseBadge } from "../../shared/components/Badges";
import { END_REASON_LABELS, floorLabel, resourceTypeLabel, SOURCE_LABELS, studentName } from "../../shared/utils/format";
import { RESOURCE_ASSIGNMENTS_PATH, type ResourceAssignment } from "../../resource-assignments/api/resourceAssignments";
import { ALLOCATIONS_PATH, type Allocation } from "../api/allocations";
import { CancelBookingDialog, EditDatesDialog, TransferDialog, VacateDialog } from "./AllocationDialogs";

type Dialog = "dates" | "transfer" | "vacate" | "cancel" | null;

const resourceColumns: Column<ResourceAssignment>[] = [
  { key: "name", header: "Resource", render: r => <strong>{r.resource.name}</strong> },
  { key: "type", header: "Type", render: r => resourceTypeLabel(r.resource) },
  { key: "dates", header: "Dates", render: r => <span className="nowrap">{formatDate(r.fromDate)} – {r.toDate ? formatDate(r.toDate) : "open"}</span> },
  { key: "phase", header: "", render: r => <PhaseBadge phase={r.phase} /> }
];

/* HO-02 allocation drawer: facts, the stay it continues, resources tied to the bed, and the
   actions of its phase (upcoming: dates, transfer, cancel; current: extend, transfer, vacate) */
export function AllocationDrawer({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const q = useApiGet<Allocation>(id ? `${ALLOCATIONS_PATH}/${id}` : null);
  const canSeeResources = can("hostel.resourceAssignments.read");
  const resources = useApiList<ResourceAssignment>(RESOURCE_ASSIGNMENTS_PATH, { allocationId: id ?? undefined, limit: 50 }, { enabled: !!id && canSeeResources });
  const [dialog, setDialog] = useState<Dialog>(null);
  const a = q.data;
  const canManage = can("hostel.allocations.manage");
  const open = a?.phase === "CURRENT" || a?.phase === "UPCOMING";
  const upcoming = a?.phase === "UPCOMING";

  const footer = canManage ? (
    a && !open ? (
      <Button onClick={onClose}>Close</Button>
    ) : (
      <>
        {/* A move-out (or transfer) is already set: only "Extend or shorten" can change it */}
        {!a?.endReason && (
          <Button variant="danger" disabled={!a} onClick={() => setDialog(upcoming ? "cancel" : "vacate")}>
            {upcoming ? "Cancel booking" : "Vacate"}
          </Button>
        )}
        {!a?.endReason && (
          <Button disabled={!a} onClick={() => setDialog("transfer")}>
            Transfer
          </Button>
        )}
        <Button variant="primary" disabled={!a} onClick={() => setDialog("dates")}>
          {upcoming ? "Edit dates" : "Extend or shorten"}
        </Button>
      </>
    )
  ) : undefined;

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={a ? studentName(a.student) : "Allocation"}
        subtitle={
          <span className="row" style={{ gap: 8, minHeight: 22 }}>
            {a ? (
              <>
                <span className="mono">{a.student.admissionNumber}</span>
                <PhaseBadge phase={a.phase} />
              </>
            ) : (
              <span className="skeleton" style={{ display: "inline-block", width: 140, height: 12 }} />
            )}
          </span>
        }
        footerStatus={canManage && a && !open ? <span className="muted">Nothing more to do: this stay is {a.phase === "CANCELLED" ? "cancelled" : "over"}</span> : null}
        footer={footer}
      >
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !a ? (
          <SkeletonBlock lines={8} />
        ) : (
          <div className="stack">
            <DescriptionList
              items={[
                {
                  label: "Hostel",
                  value: can("hostel.hostels.read") ? <Link to={`/hostel/hostels/${a.hostel.id}`}>{a.hostel.name}</Link> : a.hostel.name
                },
                { label: "Room and bed", value: `Room ${a.room.roomNumber}, bed ${a.bedNumber}` },
                { label: "Floor", value: floorLabel(a.room.floor) },
                { label: "Room type", value: a.room.roomType },
                { label: "First night", value: formatDate(a.fromDate) },
                { label: "Last night", value: a.toDate ? formatDate(a.toDate) : "No end date" },
                { label: "How", value: SOURCE_LABELS[a.source] ?? a.source },
                { label: "Ended by", value: a.endReason ? (END_REASON_LABELS[a.endReason] ?? a.endReason) : null, hidden: !a.endReason },
                { label: "Room fee", value: a.room.monthlyFee ? `${formatMoney(a.room.monthlyFee, currency)} a month` : null },
                { label: "Student code", value: <span className="mono">{a.student.studentCode}</span> },
                { label: "Notes", value: a.notes ? <span style={{ whiteSpace: "pre-line" }}>{a.notes}</span> : null, wide: true }
              ]}
            />
            {a.previousAllocationId && (
              <div className="row small muted" style={{ gap: 6 }}>
                <History size={14} />
                {a.source === "ROLLOVER" ? "Continues last year's bed." : "Continues an earlier stay."}
                <Button variant="link" onClick={() => onOpen(a.previousAllocationId!)}>
                  Open it
                </Button>
              </div>
            )}
            {canSeeResources && (
              <>
                <div className="section-title">Tied to this bed</div>
                <DataTable
                  columns={resourceColumns}
                  rows={resources.rows}
                  rowKey={r => r.id}
                  loading={resources.isLoading}
                  error={resources.error}
                  empty={<p className="muted small">No lockers or plans tied to this bed.</p>}
                />
              </>
            )}
          </div>
        )}
      </Drawer>
      <EditDatesDialog allocation={dialog === "dates" ? (a ?? null) : null} onClose={() => setDialog(null)} />
      <TransferDialog allocation={dialog === "transfer" ? (a ?? null) : null} onClose={() => setDialog(null)} onDone={next => onOpen(next.id)} />
      <VacateDialog allocation={dialog === "vacate" ? (a ?? null) : null} onClose={() => setDialog(null)} />
      <CancelBookingDialog allocation={dialog === "cancel" ? (a ?? null) : null} onClose={() => setDialog(null)} />
    </>
  );
}
