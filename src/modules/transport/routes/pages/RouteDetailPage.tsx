import { useState, type ReactNode } from "react";
import { isApiError } from "@/common/api";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardList, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiGet, useApiList, useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FormActions,
  Page,
  PersonCell,
  SkeletonBlock,
  useConfirm,
  useTabParam,
  useToast,
  type Column,
  type TabItem
} from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { SeatsBar } from "../../shared/components/SeatsBar";
import { directionLabel, hhmm, routeLabel } from "../../shared/utils/format";
import { ASSIGNMENTS_PATH, riderName, type SeatAssignment } from "../../assignments/api/assignments";
import { AssignDrawer } from "../../assignments/components/AssignDrawer";
import { AssignmentDrawer } from "../../assignments/components/AssignmentDrawer";
import { removeRoute, ROUTES_PATH, updateRoute, type RouteDetail } from "../api/routes";
import { RouteDrawer } from "../components/RouteDrawer";
import { StopsEditor, stopRowsFrom, stopsBody, validateStops, type StopRow } from "../components/StopsEditor";
import "../../shared/components/transport.css";

type Stop = RouteDetail["stops"][number];

/* TR-02 · Route: header (vehicle, seats used in the year, actions), then Stops and Students tabs */
export default function RouteDetailPage() {
  const { routeId = "" } = useParams();
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const q = useApiGet<RouteDetail>(`${ROUTES_PATH}/${routeId}`);
  const remove = useApiMutation(removeRoute, { invalidate: ["/transport"] });
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const tabs: TabItem[] = [
    { id: "stops", label: "Stops", count: q.data?.stops.length },
    { id: "students", label: "Students", count: q.data?.occupancy.assigned, hidden: !can("transport.assignments.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const r = q.data;
  const canManage = can("transport.routes.manage");
  const canAssign = can("transport.assignments.manage") && !readOnly;

  const header = (
    <DrillHeader
      back="/transport/routes"
      backLabel="Back to routes"
      title={<span style={{ display: "inline-block", width: "min(280px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{r?.name ?? ""}</span>}
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );

  const askRemove = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Remove ${routeLabel(r)}?`,
      message: `${r.name} and its ${r.stops.length} stop(s) are removed. A route with students on it can't be removed: end or move their seats first.`,
      confirmLabel: "Remove route"
    });
    if (ok)
      remove.mutate(r.id, {
        onSuccess: res => {
          toast.success(res.message || `${routeLabel(r)} removed`);
          navigate("/transport/routes");
        },
        onError: e => toast.error(e)
      });
  };

  const full = !!r && r.occupancy.capacity !== null && (r.occupancy.available ?? 0) <= 0;

  return (
    <Page>
      {header}
      <Card>
        <div className="row-between" style={{ gap: 16, alignItems: "center" }}>
          <div className="route-facts" style={{ minHeight: 44 }}>
            <Fact label="Code" value={r ? <strong className="mono">{r.code}</strong> : null} />
            <Fact
              label="Vehicle"
              value={
                r ? (
                  r.vehicle ? (
                    <span>
                      <span className="mono">{r.vehicle.registrationNumber}</span>
                      {r.vehicle.driverName && <span className="muted small"> · {r.vehicle.driverName}{r.vehicle.driverPhone ? `, ${r.vehicle.driverPhone}` : ""}</span>}
                    </span>
                  ) : (
                    <span style={{ color: "var(--warning-text)" }}>No vehicle: cannot take students</span>
                  )
                ) : null
              }
            />
            <Fact
              label={`Seats used${r?.occupancy.yearName ? ` in ${r.occupancy.yearName}` : ""}`}
              value={r ? <SeatsBar wide assigned={r.occupancy.assigned} capacity={r.occupancy.capacity} /> : null}
            />
          </div>
          <div className="row">
            {can("transport.roster.read") && (
              <ButtonLink icon={<ClipboardList />} to={`/transport/rosters?routeId=${routeId}`}>
                Roster
              </ButtonLink>
            )}
            {canAssign && (
              <Button
                icon={<Plus />}
                disabled={!r || !r.vehicle || full}
                title={r && !r.vehicle ? "Give the route a vehicle first" : full ? "The route is full" : undefined}
                onClick={() => setAssigning(true)}
              >
                Assign seat
              </Button>
            )}
            {canManage && (
              <>
                <Button icon={<Pencil />} disabled={!r} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button icon={<Trash2 />} variant="ghost" disabled={!r} onClick={() => void askRemove()} aria-label="Remove route" title="Remove route" />
              </>
            )}
          </div>
        </div>
        {r?.description && <p className="muted small" style={{ marginTop: 10 }}>{r.description}</p>}
      </Card>

      {!r ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : tab === "stops" ? (
        <StopsCard route={r} canManage={canManage} />
      ) : (
        <StudentsCard route={r} canAssign={canAssign && !!r.vehicle && !full} onAssign={() => setAssigning(true)} />
      )}

      {r && <RouteDrawer open={editing} route={r} onClose={() => setEditing(false)} />}
      <AssignDrawer open={assigning} routeId={routeId} onClose={() => setAssigning(false)} />
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="route-fact">
      <span className="route-fact-label">{label}</span>
      <span style={{ minHeight: 22, display: "flex", alignItems: "center" }}>{value ?? <span className="skeleton" style={{ display: "inline-block", width: 110, height: 14 }} />}</span>
    </div>
  );
}

/* The stops in order; holders of transport.routes.manage edit the whole list in place */
function StopsCard({ route, canManage }: { route: RouteDetail; canManage: boolean }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const [rows, setRows] = useState<StopRow[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useApiMutation(updateRoute, { invalidate: ["/transport"] });

  const start = () => {
    setRows(stopRowsFrom(route.stops));
    setErrors({});
    setFormError(null);
  };

  const submit = () => {
    if (!rows) return;
    const e = validateStops(rows);
    setErrors(e);
    setFormError(Object.keys(e).length ? "Please correct the highlighted stops." : null);
    if (Object.keys(e).length) return;
    save.mutate(
      { id: route.id, stops: stopsBody(rows) },
      {
        onSuccess: res => {
          toast.success(res.message);
          setRows(null);
        },
        onError: err => {
          if (isApiError(err) && err.isValidation && err.details.length) {
            setErrors(Object.fromEntries(err.details.map(d => [d.field, d.message])));
            setFormError("Please correct the highlighted stops.");
          } else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  const columns: Column<Stop>[] = [
    { key: "sequence", header: "#", width: 44, render: s => <span className="muted">{s.sequence}</span> },
    { key: "name", header: "Stop", render: s => <strong>{s.name}</strong> },
    { key: "pickup", header: "Pickup", render: s => hhmm(s.pickupTime) || <span className="muted">—</span> },
    { key: "drop", header: "Drop", render: s => hhmm(s.dropTime) || <span className="muted">—</span> },
    { key: "landmark", header: "Landmark", render: s => s.landmark || <span className="muted">—</span> },
    { key: "fee", header: "Monthly fee", align: "right", render: s => (s.monthlyFee ? formatMoney(s.monthlyFee, currency) : <span className="muted">—</span>) },
    { key: "students", header: "Students", align: "right", width: 90, render: s => s.assignedCount }
  ];

  if (rows)
    return (
      <Card title="Edit stops" subtitle="Drag the handle or use the arrows to reorder. Saving replaces the whole list; stops keep their students.">
        <div className="stack">
          <StopsEditor rows={rows} onChange={setRows} errors={errors} currency={currency} />
          <FormActions error={formError}>
            <Button onClick={() => setRows(null)}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={submit}>
              Save stops
            </Button>
          </FormActions>
        </div>
      </Card>
    );

  return (
    <Card
      flush
      title="Stops"
      subtitle="In the order the bus reaches them in the morning. Fees are stored for reference; they don't create invoices."
      actions={
        canManage && (
          <Button size="sm" icon={<Pencil />} onClick={start}>
            Edit stops
          </Button>
        )
      }
    >
      <DataTable
        columns={columns}
        rows={[...route.stops].sort((a, b) => a.sequence - b.sequence)}
        rowKey={s => s.id}
        empty={<EmptyState icon={<MapPin />} title="No stops" />}
      />
    </Card>
  );
}

/* Students with an active seat on the route in the selected year */
function StudentsCard({ route, canAssign, onAssign }: { route: RouteDetail; canAssign: boolean; onAssign: () => void }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useApiList<SeatAssignment>(ASSIGNMENTS_PATH, { routeId: route.id, status: "ACTIVE", page, limit: 20 });

  const columns: Column<SeatAssignment>[] = [
    { key: "student", header: "Student", render: a => <PersonCell name={riderName(a)} sub={a.student.admissionNumber} /> },
    { key: "stop", header: "Stop", render: a => `${a.stop.sequence}. ${a.stop.name}` },
    { key: "direction", header: "Direction", render: a => directionLabel(a.direction) },
    { key: "from", header: "From", render: a => <span className="nowrap">{formatDate(a.startDate)}</span> }
  ];

  return (
    <Card
      flush
      title="Students"
      subtitle={route.occupancy.yearName ? `Active seats in ${route.occupancy.yearName}` : undefined}
      actions={
        canAssign && (
          <Button size="sm" icon={<Plus />} onClick={onAssign}>
            Assign seat
          </Button>
        )
      }
    >
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={a => a.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={a => setOpenId(a.id)}
        empty={<EmptyState icon={<Users />} title="No students on this route" message={route.vehicle ? undefined : "Give the route a vehicle before assigning students."} />}
      />
      <AssignmentDrawer id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} />
    </Card>
  );
}
