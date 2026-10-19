import { useEffect, useState } from "react";
import { ChevronDown, ClipboardList, Download, Printer } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, ErrorState, Menu, MenuItem, Page, Select, SkeletonBlock, useToast, type Column } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { directionLabel, routeLabel, timesLabel } from "../../shared/utils/format";
import { useAllRoutes } from "../../routes/api/routes";
import { rosterPath, type Roster, type RosterRider } from "../api/roster";
import "../../shared/components/transport.css";

const columns: Column<RosterRider>[] = [
  { key: "name", header: "Student", render: s => <strong>{s.name}</strong> },
  { key: "classSection", header: "Class-Section", render: s => s.classSection ?? <span className="muted">—</span> },
  { key: "rollNumber", header: "Roll no.", render: s => s.rollNumber ?? <span className="muted">—</span> },
  { key: "direction", header: "Direction", render: s => directionLabel(s.direction) },
  { key: "parentName", header: "Parent", render: s => s.parentName ?? <span className="muted">—</span> },
  { key: "parentPhone", header: "Parent phone", render: s => (s.parentPhone ? <span className="nowrap">{s.parentPhone}</span> : <span className="muted">—</span>) }
];

/* TR-04 · Rosters: who boards where on one route, stop by stop, for the driver and attendant.
   Prints from the browser (the print stylesheet hides the app around the sheet); exports as CSV or Excel. */
export default function RosterPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { params, setParam } = useListParams({ routeId: "" });
  const canListRoutes = can("transport.routes.read");
  const routes = useAllRoutes(canListRoutes);
  const roster = useApiGet<Roster>(params.routeId ? rosterPath(params.routeId) : null);
  const [exporting, setExporting] = useState<string | null>(null);

  /* Open on the first route when none is chosen */
  const first = routes.rows?.[0]?.id;
  useEffect(() => {
    if (!params.routeId && first) setParam("routeId", first);
  }, [params.routeId, first, setParam]);

  const exportAs = async (format: "csv" | "xlsx") => {
    if (!params.routeId) return;
    setExporting(format);
    try {
      await api.download(rosterPath(params.routeId), { format }, `roster.${format}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(null);
    }
  };

  const r = roster.data;

  return (
    <Page>
      <div className="no-print">
        <PageIntro
          actions={
            <>
              <Button icon={<Printer />} disabled={!r} onClick={() => window.print()}>
                Print
              </Button>
              <Menu
                trigger={toggle => (
                  <Button icon={<Download />} disabled={!r} loading={!!exporting} onClick={toggle}>
                    Export <ChevronDown size={14} />
                  </Button>
                )}
              >
                {close => (
                  <>
                    <MenuItem
                      onClick={() => {
                        close();
                        void exportAs("xlsx");
                      }}
                    >
                      Excel (.xlsx)
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close();
                        void exportAs("csv");
                      }}
                    >
                      CSV
                    </MenuItem>
                  </>
                )}
              </Menu>
            </>
          }
        >
          The list for the driver and attendant: each stop in order with the students who board there.
        </PageIntro>
      </div>

      {canListRoutes && (
        <Card flush className="no-print">
          <div className="filter-bar" style={{ borderBottom: 0 }}>
            <Select
              label="Route"
              className="select-sm"
              fieldClassName="filter-wide"
              required
              value={params.routeId}
              onChange={e => setParam("routeId", e.target.value)}
              placeholder={routes.isLoading ? "Loading routes…" : "Pick a route"}
              options={(routes.rows ?? []).map(x => ({ value: x.id, label: `${x.code} · ${x.name}` }))}
            />
          </div>
        </Card>
      )}

      {!params.routeId ? (
        routes.isLoading ? (
          <Card>
            <SkeletonBlock lines={6} />
          </Card>
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title={canListRoutes ? "No routes yet" : "Open a roster from a route"}
            message={canListRoutes ? "Create a route with its stops first." : "Ask for access to view routes to pick one here."}
          />
        )
      ) : roster.error ? (
        <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />
      ) : !r ? (
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      ) : (
        <div className="roster-sheet">
          <Card>
            <div className="stack">
              <div className="roster-print-title">
                {routeLabel(r.route)} · {r.route.name} · {r.academicYear.yearName}
              </div>
              <div className="roster-head">
                <Item label="Route" value={`${r.route.code} · ${r.route.name}`} />
                <Item label="Year" value={r.academicYear.yearName} />
                <Item label="Vehicle" value={r.vehicle ? r.vehicle.registrationNumber : "No vehicle"} />
                <Item label="Driver" value={r.vehicle?.driverName ? `${r.vehicle.driverName}${r.vehicle.driverPhone ? ` · ${r.vehicle.driverPhone}` : ""}` : "—"} />
                <Item label="Attendant" value={r.vehicle?.attendantName ? `${r.vehicle.attendantName}${r.vehicle.attendantPhone ? ` · ${r.vehicle.attendantPhone}` : ""}` : "—"} />
                <Item
                  label="Seats"
                  value={r.occupancy.capacity === null ? `${r.occupancy.assigned} students · – seats` : `${r.occupancy.assigned} of ${r.occupancy.capacity} taken · ${r.occupancy.available} free`}
                />
              </div>
              {r.route.description && <p className="small muted">{r.route.description}</p>}
            </div>
          </Card>
          {r.stops.map(s => (
            <section key={s.id} className="roster-stop">
              <Card flush>
                <div className="card-header">
                  <div className="roster-stop-title">
                    <span>
                      {s.sequence} · {s.name} · {timesLabel(s.pickupTime, s.dropTime)}
                    </span>
                    {s.landmark && <span className="muted small">{s.landmark}</span>}
                    <span className="muted small">
                      {s.students.length} student{s.students.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                {s.students.length ? (
                  <DataTable columns={columns} rows={s.students} rowKey={x => x.assignmentId} />
                ) : (
                  <div className="card-body muted small">No students</div>
                )}
              </Card>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="route-fact">
      <span className="route-fact-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
