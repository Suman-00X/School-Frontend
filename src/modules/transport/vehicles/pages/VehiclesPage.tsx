import { useState } from "react";
import { AlertTriangle, Bus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Menu, MenuItem, Page, Select, useConfirm, useToast, type Column } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_TONES, VEHICLE_STATUSES } from "../../shared/utils/format";
import { removeVehicle, VEHICLES_PATH, type Vehicle } from "../api/vehicles";
import { DocumentBadges } from "../components/DocumentBadges";
import { VehicleDrawer } from "../components/VehicleDrawer";

const COMPLIANCE_OPTIONS = [
  { value: "0", label: "Expired or due today" },
  { value: "30", label: "Due within 30 days" },
  { value: "60", label: "Due within 60 days" },
  { value: "90", label: "Due within 90 days" }
];

/* TR-01 · Vehicles: buses and vans, their crew and compliance dates (list + drawer) */
export default function VehiclesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setParams, setPage } = useListParams({ status: "", expiringWithinDays: "" });
  const list = useApiList<Vehicle>(VEHICLES_PATH, params);
  /* Vehicles with an expired document, for the line under the header */
  const expired = useApiList<Vehicle>(VEHICLES_PATH, { expiringWithinDays: 0, limit: 100 });
  const expiredCount = (expired.rows ?? []).filter(v => v.expiringDocuments.some(d => d.isExpired)).length;
  const [drawer, setDrawer] = useState<{ vehicle: Vehicle | null } | null>(null);
  const canManage = can("transport.vehicles.manage");
  const remove = useApiMutation(removeVehicle, { invalidate: ["/transport"] });

  const askRemove = async (v: Vehicle) => {
    const ok = await confirm({
      title: `Remove ${v.registrationNumber}?`,
      message: `${v.registrationNumber} is taken off the vehicle list. A vehicle that serves a route can't be removed: give the route another vehicle first.`,
      confirmLabel: "Remove vehicle"
    });
    if (ok) remove.mutate(v.id, { onSuccess: res => toast.success(res.message || `${v.registrationNumber} removed`), onError: e => toast.error(e) });
  };

  const filtered = !!(params.status || params.expiringWithinDays);
  const addButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ vehicle: null })}>
      Add vehicle
    </Button>
  );

  const columns: Column<Vehicle>[] = [
    { key: "registrationNumber", header: "Registration", width: 140, render: v => <strong className="mono">{v.registrationNumber}</strong> },
    {
      key: "makeModel",
      header: "Make / model",
      render: v => [v.make, v.model].filter(Boolean).join(" ") || <span className="muted">—</span>
    },
    { key: "capacity", header: "Seats", align: "right", width: 70 },
    { key: "driverName", header: "Driver", render: v => v.driverName || <span className="muted">—</span> },
    { key: "driverPhone", header: "Driver phone", render: v => (v.driverPhone ? <span className="nowrap">{v.driverPhone}</span> : <span className="muted">—</span>) },
    {
      key: "status",
      header: "Status",
      render: v => (
        <Badge tone={VEHICLE_STATUS_TONES[v.status]} dot>
          {VEHICLE_STATUS_LABELS[v.status]}
        </Badge>
      )
    },
    { key: "documents", header: "Documents", render: v => <DocumentBadges documents={v.expiringDocuments} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: v =>
        canManage && (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ vehicle: v })} aria-label={`Edit ${v.registrationNumber}`} title="Edit" />
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${v.registrationNumber}`} title="More" />}>
              {close => (
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onClick={() => {
                    close();
                    void askRemove(v);
                  }}
                >
                  Remove
                </MenuItem>
              )}
            </Menu>
          </div>
        )
    }
  ];

  return (
    <Page>
      <PageIntro actions={addButton}>
        {expiredCount > 0 ? (
          <span className="intro-alert">
            <AlertTriangle />
            {expiredCount === 1 ? "1 vehicle has" : `${expiredCount} vehicles have`} an expired document.
            {params.expiringWithinDays !== "0" && (
              <Button variant="link" onClick={() => setParams({ expiringWithinDays: "0", status: "" })}>
                Show {expiredCount === 1 ? "it" : "them"}
              </Button>
            )}
          </span>
        ) : (
          "School buses and vans, their crew, and when their insurance, fitness certificate and permit run out."
        )}
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Status"
            className="select-sm"
            value={params.status}
            onChange={e => setParam("status", e.target.value)}
            placeholder="All statuses"
            options={VEHICLE_STATUSES.map(s => ({ value: s, label: VEHICLE_STATUS_LABELS[s] }))}
          />
          <Select
            label="Compliance"
            className="select-sm"
            fieldClassName="filter-wide"
            value={params.expiringWithinDays}
            onChange={e => setParam("expiringWithinDays", e.target.value)}
            placeholder="All vehicles"
            options={COMPLIANCE_OPTIONS}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={v => v.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={v => setDrawer({ vehicle: v })}
          empty={
            filtered ? (
              <EmptyState
                icon={<Bus />}
                title={params.expiringWithinDays ? "No documents due in this window" : "No vehicles match these filters"}
                message={params.expiringWithinDays && !params.status ? "Retired vehicles are left out of the compliance view unless you pick Retired." : undefined}
                actions={<Button onClick={() => setParams({ status: "", expiringWithinDays: "" })}>Clear filters</Button>}
              />
            ) : (
              <EmptyState icon={<Bus />} title="No vehicles yet" message="Add the school's buses and vans, then give each route a vehicle." actions={addButton} />
            )
          }
        />
      </Card>
      <VehicleDrawer open={!!drawer} vehicle={drawer?.vehicle ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Page>
  );
}
