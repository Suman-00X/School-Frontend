import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Route as RouteIcon } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, Select, type Column } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { SeatsBar } from "../../shared/components/SeatsBar";
import { useAllVehicles } from "../../vehicles/api/vehicles";
import { ROUTES_PATH, type TransportRoute } from "../api/routes";
import { RouteDrawer } from "../components/RouteDrawer";

/* TR-02 · Routes: bus routes with their vehicle, seats used in the selected year and stops */
export default function RoutesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { selected } = useAcademicYear();
  const { params, setParam, setPage } = useListParams({ vehicleId: "" });
  const list = useApiList<TransportRoute>(ROUTES_PATH, params);
  const vehicles = useAllVehicles(can("transport.vehicles.read"));
  const [creating, setCreating] = useState(false);
  const canManage = can("transport.routes.manage");

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      New route
    </Button>
  );

  const columns: Column<TransportRoute>[] = [
    { key: "code", header: "Code", width: 100, render: r => <strong className="mono">{r.code}</strong> },
    { key: "name", header: "Name", render: r => r.name },
    {
      key: "vehicle",
      header: "Vehicle",
      render: r =>
        r.vehicle ? (
          <span className="mono nowrap">{r.vehicle.registrationNumber}</span>
        ) : (
          <span className="small" style={{ color: "var(--warning-text)" }}>
            No vehicle: cannot take students
          </span>
        )
    },
    {
      key: "seats",
      header: "Seats used",
      render: r => <SeatsBar assigned={r.occupancy.assigned} capacity={r.occupancy.capacity} />
    },
    { key: "stops", header: "Stops", align: "right", width: 70, render: r => r.stops.length }
  ];

  return (
    <Page>
      <PageIntro actions={newButton}>
        Routes, the vehicle that runs each one and its stops in order. Seats used are counted in {selected?.yearName ?? "the current year"}.
      </PageIntro>
      <Card flush>
        {can("transport.vehicles.read") && (
          <div className="filter-bar">
            <Select
              label="Vehicle"
              className="select-sm"
              value={params.vehicleId}
              onChange={e => setParam("vehicleId", e.target.value)}
              placeholder="All vehicles"
              options={(vehicles.rows ?? []).map(v => ({ value: v.id, label: v.registrationNumber, description: [v.make, v.model].filter(Boolean).join(" ") }))}
            />
          </div>
        )}
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => navigate(`/transport/routes/${r.id}`)}
          empty={
            params.vehicleId ? (
              <EmptyState icon={<RouteIcon />} title="This vehicle serves no route" />
            ) : (
              <EmptyState icon={<RouteIcon />} title="No routes yet" message="Create a route with its stops, then give it a vehicle so students can be assigned." actions={newButton} />
            )
          }
        />
      </Card>
      <RouteDrawer open={creating} route={null} onClose={() => setCreating(false)} />
    </Page>
  );
}
