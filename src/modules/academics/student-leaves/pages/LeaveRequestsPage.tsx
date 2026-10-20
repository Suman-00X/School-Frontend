import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, PersonCell, Select, StatusBadge, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { PageIntro } from "../../shared/components/PageIntro";
import { SectionSelect } from "../../shared/components/SectionSelect";
import {
  LEAVE_STATUS_OPTIONS,
  STUDENT_LEAVES_PATH,
  leaveDates,
  leaveDays,
  reasonLabel,
  sectionName,
  studentName,
  type StudentLeave
} from "../api/studentLeaves";
import { LeaveDecisionDialog, LeaveRequestDrawer } from "../components/LeaveRequestDrawer";

/* AC-09c · Leave requests (Attendance side list): leave parents asked for their children in the
   header's year. Opens on pending ones, so it works as the class teacher's approval queue;
   a teacher sees the sections they teach and decides for the ones they lead. */
export default function LeaveRequestsPage() {
  const { params, setParam, setPage } = useListParams({ status: "PENDING", sectionId: "", from: "", to: "" });
  const list = useApiList<StudentLeave>(STUDENT_LEAVES_PATH, {
    page: params.page,
    limit: params.limit,
    status: params.status === "ALL" ? undefined : params.status,
    sectionId: params.sectionId || undefined,
    from: params.from || undefined,
    to: params.to || undefined
  });
  const pending = (list.meta as { pending?: number } | undefined)?.pending;

  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ request: StudentLeave; decision: "APPROVED" | "REJECTED" } | null>(null);
  /* The drawer shows the row as it is in the latest list (refreshed after a decision) */
  const [lastSeen, setLastSeen] = useState<StudentLeave | null>(null);
  const open = (openId && (list.rows?.find(r => r.id === openId) ?? (lastSeen?.id === openId ? lastSeen : null))) || null;

  const filtered = params.status !== "PENDING" || !!params.sectionId || !!params.from || !!params.to;

  const columns: Column<StudentLeave>[] = [
    { key: "student", header: "Student", render: r => <PersonCell name={studentName(r)} sub={sectionName(r)} /> },
    {
      key: "dates",
      header: "Dates",
      render: r => (
        <span className="row nowrap" style={{ gap: 6 }}>
          {leaveDates(r)}
          {r.session !== "FULL_DAY" && <Badge tone="info">½ day</Badge>}
        </span>
      )
    },
    { key: "days", header: "Days", align: "right", render: r => <span className="nowrap">{leaveDays(r.days)}</span> },
    {
      key: "reason",
      header: "Reason",
      render: r => (
        <span style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 280 }}>
          <span>{reasonLabel(r.reasonCategory)}</span>
          <span className="small muted" title={r.reason} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.reason}
          </span>
        </span>
      )
    },
    { key: "status", header: "Status", render: r => <StatusBadge status={r.status} /> },
    { key: "applied", header: "Applied", render: r => <span className="nowrap">{formatDate(r.createdAt)}</span> }
  ];

  const statusLabel = LEAVE_STATUS_OPTIONS.find(o => o.value === params.status)?.label.toLowerCase();

  return (
    <div className="stack">
      <PageIntro>
        {pending ? `${pending} waiting for your decision. ` : ""}Approving a leave turns absences already marked on its days into excused.
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select label="Status" className="select-sm" value={params.status} onChange={e => setParam("status", e.target.value)} options={LEAVE_STATUS_OPTIONS} required />
          <SectionSelect className="select-sm" value={params.sectionId} placeholder="All sections" onChange={e => setParam("sectionId", e.target.value)} />
          <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => {
            setOpenId(r.id);
            setLastSeen(r);
          }}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<CalendarCheck2 />} title={`No ${statusLabel === "all requests" ? "" : `${statusLabel} `}requests match these filters`} />
            ) : (
              <EmptyState icon={<CalendarCheck2 />} title="Nothing waiting" message="When a parent applies for their child's leave, it shows here for the class teacher to approve." />
            )
          }
        />
      </Card>
      <LeaveRequestDrawer request={open} onClose={() => setOpenId(null)} onDecide={(request, d) => setDecision({ request, decision: d })} />
      <LeaveDecisionDialog
        key={decision ? decision.request.id + decision.decision : "none"}
        request={decision?.request ?? null}
        decision={decision?.decision ?? "APPROVED"}
        onClose={() => setDecision(null)}
        onDone={setLastSeen}
      />
    </div>
  );
}
