import { BedDouble } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, DataTable, EmptyState, PersonCell, Select, Tabs, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { PhaseBadge } from "../../shared/components/Badges";
import { END_REASON_LABELS, PHASE_LABELS, PHASES, SOURCE_LABELS, studentName } from "../../shared/utils/format";
import { useAllHostels } from "../../hostels/api/hostels";
import { ROOMS_PATH, type Room } from "../../rooms/api/rooms";
import { ALLOCATIONS_PATH, type Allocation } from "../api/allocations";

const columns: Column<Allocation>[] = [
  { key: "student", header: "Student", render: a => <PersonCell name={studentName(a.student)} sub={a.student.admissionNumber} /> },
  { key: "code", header: "Code", render: a => <span className="mono small">{a.student.studentCode}</span> },
  { key: "hostel", header: "Hostel", render: a => <span title={a.hostel.name}>{a.hostel.code}</span> },
  { key: "room", header: "Room", render: a => a.room.roomNumber },
  { key: "bed", header: "Bed", align: "right", width: 56, render: a => a.bedNumber },
  { key: "from", header: "From", render: a => <span className="nowrap">{formatDate(a.fromDate)}</span> },
  { key: "to", header: "To", render: a => (a.toDate ? <span className="nowrap">{formatDate(a.toDate)}</span> : <span className="muted">No end</span>) },
  { key: "phase", header: "Phase", render: a => <PhaseBadge phase={a.phase} /> },
  { key: "source", header: "Source", render: a => SOURCE_LABELS[a.source] ?? a.source },
  { key: "endReason", header: "End reason", render: a => (a.endReason ? (END_REASON_LABELS[a.endReason] ?? a.endReason) : <span className="muted">—</span>) }
];

/* HO-02 list view: allocations by phase, hostel, room, student and dates */
export function AllocationList({ onOpen }: { onOpen: (id: string) => void }) {
  const { can } = useAuth();
  const { params, setParam, setParams, setPage } = useListParams({ phase: "CURRENT", hostelId: "", roomId: "", studentId: "", activeOn: "", fromDate: "", toDate: "" });
  const list = useApiList<Allocation>(ALLOCATIONS_PATH, {
    ...params,
    phase: params.phase === "ALL" ? undefined : params.phase,
    toDate: params.fromDate ? params.toDate : undefined
  });
  const hostels = useAllHostels(can("hostel.hostels.read"));
  const rooms = useApiList<Room>(ROOMS_PATH, { hostelId: params.hostelId, limit: 100 }, { enabled: !!params.hostelId && can("hostel.rooms.read") });
  const filtered = !!(params.hostelId || params.studentId || params.activeOn || params.fromDate);

  return (
    <>
      <div style={{ padding: "0 14px" }}>
        <Tabs
          tabs={[...PHASES.map(p => ({ id: p, label: PHASE_LABELS[p] })), { id: "ALL", label: "All" }]}
          value={params.phase}
          onChange={id => setParam("phase", id)}
        />
      </div>
      <div className="filter-bar">
        {can("hostel.hostels.read") && (
          <Select
            label="Hostel"
            className="select-sm"
            value={params.hostelId}
            onChange={e => setParams({ hostelId: e.target.value, roomId: "" })}
            placeholder="All hostels"
            options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
          />
        )}
        {can("hostel.rooms.read") && (
          <Select
            label="Room"
            className="select-sm"
            value={params.roomId}
            onChange={e => setParam("roomId", e.target.value)}
            placeholder={params.hostelId ? "All rooms" : "Pick a hostel first"}
            disabled={!params.hostelId}
            options={(rooms.rows ?? []).map(r => ({ value: r.id, label: `Room ${r.roomNumber}` }))}
          />
        )}
        <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="All students" />
        <TextInput label="Staying on" type="date" className="input-sm" value={params.activeOn} onChange={e => setParam("activeOn", e.target.value)} />
        <TextInput label="Stays between" type="date" className="input-sm" value={params.fromDate} onChange={e => setParam("fromDate", e.target.value)} />
        <TextInput label="and" type="date" className="input-sm" min={params.fromDate || undefined} disabled={!params.fromDate} value={params.toDate} onChange={e => setParam("toDate", e.target.value)} />
      </div>
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={a => a.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={a => onOpen(a.id)}
        empty={
          <EmptyState
            icon={<BedDouble />}
            title={filtered ? "No allocations match these filters" : params.phase === "ALL" ? "No allocations yet" : `No ${PHASE_LABELS[params.phase as keyof typeof PHASE_LABELS]?.toLowerCase() ?? ""} allocations`}
            actions={
              filtered && <Button onClick={() => setParams({ hostelId: "", roomId: "", studentId: "", activeOn: "", fromDate: "", toDate: "" })}>Clear filters</Button>
            }
          />
        }
      />
    </>
  );
}
