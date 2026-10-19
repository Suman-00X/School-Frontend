import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Menu, MenuItem, Page, Select, Tabs, useConfirm, useToast, type Column } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { PageIntro } from "../../shared/components/PageIntro";
import { RESOURCE_STATUS_LABELS, RESOURCE_STATUSES, RESOURCE_TYPE_LABELS, RESOURCE_TYPES, resourceTypeLabel } from "../../shared/utils/format";
import { useAllHostels } from "../../hostels/api/hostels";
import { ROOMS_PATH, type Room } from "../../rooms/api/rooms";
import { removeResource, RESOURCES_PATH, type Resource } from "../api/resources";
import { ResourceDrawer } from "../components/ResourceDrawer";

/* Quick tabs: one per kind (the API filters one type at a time) */
const TYPE_TABS = [{ id: "ALL", label: "All" }, ...RESOURCE_TYPES.map(t => ({ id: t, label: `${RESOURCE_TYPE_LABELS[t]}s`.replace("Others", "Other") }))];

/* HO-03 · Resources: lockers, cupboards, study tables, mess and laundry plans, with today's use */
export default function ResourcesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const currency = useSchoolCurrency();
  const { params, setParam, setParams, setPage } = useListParams({ resourceType: "ALL", hostelId: "", roomId: "", status: "" });
  const list = useApiList<Resource>(RESOURCES_PATH, { ...params, resourceType: params.resourceType === "ALL" ? undefined : params.resourceType });
  const hostels = useAllHostels();
  const rooms = useApiList<Room>(ROOMS_PATH, { hostelId: params.hostelId, limit: 100 }, { enabled: !!params.hostelId && can("hostel.rooms.read") });
  const [drawer, setDrawer] = useState<{ resource: Resource | null } | null>(null);
  const remove = useApiMutation(removeResource, { invalidate: ["/hostel"] });
  const canManage = can("hostel.resources.manage");
  const canSeeHolders = can("hostel.resourceAssignments.read");

  const askRemove = async (r: Resource) => {
    const ok = await confirm({
      title: `Remove ${r.name}?`,
      message: `${r.name} (${resourceTypeLabel(r).toLowerCase()}, ${r.hostel.name}) is removed. A resource someone still holds can't be removed: release or cancel those first.`,
      confirmLabel: "Remove resource"
    });
    if (ok) remove.mutate(r.id, { onSuccess: res => toast.success(res.message || `${r.name} removed`), onError: e => toast.error(e) });
  };

  const addButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ resource: null })}>
      Add resource
    </Button>
  );

  const columns: Column<Resource>[] = [
    { key: "name", header: "Name", render: r => <strong>{r.name}</strong> },
    { key: "type", header: "Type", render: r => resourceTypeLabel(r) },
    { key: "hostel", header: "Hostel", render: r => <span title={r.hostel.name}>{r.hostel.code}</span> },
    { key: "room", header: "Room", render: r => (r.room ? r.room.roomNumber : <span className="muted">Hostel-wide</span>) },
    { key: "capacity", header: "Capacity", align: "right", render: r => r.capacity },
    { key: "inUse", header: "In use today", align: "right", render: r => r.inUse },
    { key: "available", header: "Free", align: "right", render: r => (r.available ? r.available : <span className="muted">0</span>) },
    { key: "fee", header: "Fee", align: "right", render: r => (r.monthlyFee ? formatMoney(r.monthlyFee, currency) : <span className="muted">—</span>) },
    {
      key: "status",
      header: "Status",
      render: r => (
        <Badge tone={r.status === "AVAILABLE" ? "success" : "warning"} dot>
          {RESOURCE_STATUS_LABELS[r.status]}
        </Badge>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: r =>
        (canManage || canSeeHolders) && (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            {canManage && <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ resource: r })} aria-label={`Edit ${r.name}`} title="Edit" />}
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${r.name}`} title="More" />}>
              {close => (
                <>
                  {canSeeHolders && (
                    <MenuItem
                      icon={<Users />}
                      onClick={() => {
                        close();
                        navigate(`/hostel/resource-assignments?resourceId=${r.id}&phase=ALL`);
                      }}
                    >
                      See who holds it
                    </MenuItem>
                  )}
                  {canManage && (
                    <MenuItem
                      icon={<Trash2 />}
                      danger
                      onClick={() => {
                        close();
                        void askRemove(r);
                      }}
                    >
                      Remove
                    </MenuItem>
                  )}
                </>
              )}
            </Menu>
          </div>
        )
    }
  ];

  const filtered = !!(params.hostelId || params.status);

  return (
    <Page>
      <PageIntro actions={addButton}>Lockers, cupboards and study tables in rooms or hostel-wide, and the mess and laundry plans. Fees are stored for reference.</PageIntro>
      <Card flush>
        <div style={{ padding: "0 14px" }}>
          <Tabs tabs={TYPE_TABS} value={params.resourceType} onChange={id => setParam("resourceType", id)} />
        </div>
        <div className="filter-bar">
          <Select
            label="Hostel"
            className="select-sm"
            value={params.hostelId}
            onChange={e => setParams({ hostelId: e.target.value, roomId: "" })}
            placeholder="All hostels"
            options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
          />
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
          <Select
            label="Status"
            className="select-sm"
            value={params.status}
            onChange={e => setParam("status", e.target.value)}
            placeholder="All statuses"
            options={RESOURCE_STATUSES.map(s => ({ value: s, label: RESOURCE_STATUS_LABELS[s] }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => setDrawer({ resource: r })}
          empty={
            filtered || params.resourceType !== "ALL" ? (
              <EmptyState icon={<Lock />} title="No resources match" actions={filtered && <Button onClick={() => setParams({ hostelId: "", roomId: "", status: "" })}>Clear filters</Button>} />
            ) : (
              <EmptyState icon={<Lock />} title="No resources yet" message="Add lockers, cupboards, study tables, and mess or laundry plans." actions={addButton} />
            )
          }
        />
      </Card>
      <ResourceDrawer open={!!drawer} resource={drawer?.resource ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Page>
  );
}
