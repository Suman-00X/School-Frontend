import { useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRightLeft, Armchair, CircleStop, MoreHorizontal, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Menu, MenuItem, Page, PersonCell, Select, StatusBadge, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { PageIntro } from "../../shared/components/PageIntro";
import { directionLabel, timesLabel } from "../../shared/utils/format";
import { useAllRoutes } from "../../routes/api/routes";
import { ASSIGNMENTS_PATH, riderName, type SeatAssignment } from "../api/assignments";
import { AssignDrawer } from "../components/AssignDrawer";
import { AssignmentDrawer } from "../components/AssignmentDrawer";
import { ChangeSeatDialog, EndSeatDialog } from "../components/SeatDialogs";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ENDED", label: "Ended" },
  { value: "ALL", label: "Active and ended" }
];

/* TR-03 · Seat assignments: who rides which route and stop in the selected year.
   /transport/assignments/:assignmentId opens one in the drawer; ?new=1 opens "Assign". */
export default function AssignmentsPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const navigate = useNavigate();
  const location = useLocation();
  const { assignmentId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { params, setParam, setParams, setPage } = useListParams({ routeId: "", stopId: "", studentId: "", status: "ACTIVE" });
  const list = useApiList<SeatAssignment>(ASSIGNMENTS_PATH, {
    page: params.page,
    limit: params.limit,
    routeId: params.routeId,
    stopId: params.stopId,
    studentId: params.studentId,
    status: params.status === "ALL" ? undefined : params.status
  });
  const routes = useAllRoutes(can("transport.routes.read"));
  const route = routes.rows?.find(r => r.id === params.routeId);
  const [changing, setChanging] = useState<SeatAssignment | null>(null);
  const [ending, setEnding] = useState<SeatAssignment | null>(null);

  const canManage = can("transport.assignments.manage") && !readOnly;
  const assigning = canManage && search.get("new") === "1";
  const setAssigning = (on: boolean) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        if (on) next.set("new", "1");
        else next.delete("new");
        return next;
      },
      { replace: true }
    );

  /* The drawer is a path; the filters stay in the query */
  const openSeat = (id: string | null) => {
    const qs = new URLSearchParams(location.search);
    qs.delete("new");
    navigate({ pathname: id ? `${ASSIGNMENTS_PATH}/${id}` : ASSIGNMENTS_PATH, search: qs.toString() });
  };

  const assignButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setAssigning(true)}>
      Assign seat
    </Button>
  );

  const filtered = !!(params.routeId || params.studentId);

  const columns: Column<SeatAssignment>[] = [
    { key: "student", header: "Student", render: a => <PersonCell name={riderName(a)} sub={a.student.admissionNumber} /> },
    { key: "code", header: "Code", render: a => <span className="mono small">{a.student.studentCode}</span> },
    {
      key: "route",
      header: "Route",
      render: a => (
        <span title={a.route.name}>
          <strong className="mono">{a.route.code}</strong> <span className="muted small">{a.route.name}</span>
        </span>
      )
    },
    { key: "stop", header: "Stop", render: a => a.stop.name },
    { key: "times", header: "Pickup / drop", render: a => <span className="nowrap">{timesLabel(a.stop.pickupTime, a.stop.dropTime)}</span> },
    { key: "direction", header: "Direction", render: a => <span className="nowrap">{directionLabel(a.direction)}</span> },
    { key: "from", header: "From", render: a => <span className="nowrap">{formatDate(a.startDate)}</span> },
    { key: "to", header: "To", render: a => (a.endDate ? <span className="nowrap">{formatDate(a.endDate)}</span> : <span className="muted">—</span>) },
    { key: "status", header: "Status", render: a => <StatusBadge status={a.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 52,
      render: a =>
        canManage &&
        a.status === "ACTIVE" && (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`Actions for ${riderName(a)}`} title="More" />}>
              {close => (
                <>
                  <MenuItem
                    icon={<ArrowRightLeft />}
                    onClick={() => {
                      close();
                      setChanging(a);
                    }}
                  >
                    Change route or stop
                  </MenuItem>
                  <MenuItem
                    icon={<CircleStop />}
                    danger
                    onClick={() => {
                      close();
                      setEnding(a);
                    }}
                  >
                    End seat
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        )
    }
  ];

  return (
    <Page>
      <PageIntro actions={assignButton}>
        Which student rides which route and stop in {year?.yearName ?? "the current year"}.
        {readOnly && " The year is archived, so its seats are read-only here."}
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          {can("transport.routes.read") && (
            <>
              <Select
                label="Route"
                className="select-sm"
                fieldClassName="filter-wide"
                value={params.routeId}
                onChange={e => setParams({ routeId: e.target.value, stopId: "" })}
                placeholder="All routes"
                options={(routes.rows ?? []).map(r => ({ value: r.id, label: `${r.code} · ${r.name}` }))}
              />
              <Select
                label="Stop"
                className="select-sm"
                value={params.stopId}
                onChange={e => setParam("stopId", e.target.value)}
                placeholder={route ? "All stops" : "Pick a route first"}
                disabled={!route}
                options={[...(route?.stops ?? [])].sort((a, b) => a.sequence - b.sequence).map(s => ({ value: s.id, label: `${s.sequence}. ${s.name}` }))}
              />
            </>
          )}
          <StudentSelect
            label="Student"
            className="select-sm"
            value={params.studentId}
            onChange={e => setParam("studentId", e.target.value)}
            placeholder="All students"
          />
          <Select label="Status" className="select-sm" required value={params.status} onChange={e => setParam("status", e.target.value)} options={STATUS_OPTIONS} />
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
          onRowClick={a => openSeat(a.id)}
          empty={
            filtered ? (
              <EmptyState
                icon={<Armchair />}
                title={params.status === "ENDED" ? "No ended seats match" : "No seats match these filters"}
                actions={<Button onClick={() => setParams({ routeId: "", stopId: "", studentId: "" })}>Clear filters</Button>}
              />
            ) : params.status === "ENDED" ? (
              <EmptyState icon={<Armchair />} title={`No seats have ended in ${year?.yearName ?? "this year"}`} />
            ) : (
              <EmptyState
                icon={<Armchair />}
                title={`No students on school transport in ${year?.yearName ?? "this year"}`}
                message="Assign a student to a route and stop. Seats belong to one academic year."
                actions={assignButton}
              />
            )
          }
        />
      </Card>
      <AssignDrawer open={assigning} routeId={params.routeId || undefined} studentId={params.studentId || undefined} onClose={() => setAssigning(false)} onDone={a => openSeat(a.id)} />
      <AssignmentDrawer id={assignmentId ?? null} onClose={() => openSeat(null)} onOpen={openSeat} />
      <ChangeSeatDialog assignment={changing} onClose={() => setChanging(null)} />
      <EndSeatDialog assignment={ending} onClose={() => setEnding(null)} />
    </Page>
  );
}
