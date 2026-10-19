import { useMemo, useState } from "react";
import { DoorOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Menu, MenuItem, Select, useConfirm, useToast, type Column } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { RoomStatusBadge } from "../../shared/components/Badges";
import { floorLabel, ROOM_STATUS_LABELS, ROOM_STATUSES } from "../../shared/utils/format";
import { removeRoom, ROOMS_PATH, type Room } from "../api/rooms";
import { RoomDrawer } from "./RoomDrawer";

/* HO-01 Rooms tab: a hostel's rooms with today's beds; add, edit and remove for holders of hostel.rooms.manage */
export function RoomsPanel({ hostelId, hostelName }: { hostelId: string; hostelName: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = useSchoolCurrency();
  const { params, setParam, setPage } = useListParams({ status: "", floor: "" });
  const list = useApiList<Room>(ROOMS_PATH, { hostelId, ...params });
  /* Every room of the hostel, for the floor filter and the room types on offer */
  const all = useApiList<Room>(ROOMS_PATH, { hostelId, limit: 100 });
  const [drawer, setDrawer] = useState<{ room: Room | null } | null>(null);
  const remove = useApiMutation(removeRoom, { invalidate: ["/hostel"] });
  const canManage = can("hostel.rooms.manage");

  const floors = useMemo(() => [...new Set((all.rows ?? []).map(r => r.floor).filter((f): f is number => f !== null))].sort((a, b) => a - b), [all.rows]);
  const roomTypes = useMemo(() => [...new Set((all.rows ?? []).map(r => r.roomType).filter((t): t is string => !!t))].sort(), [all.rows]);

  const askRemove = async (r: Room) => {
    const ok = await confirm({
      title: `Remove room ${r.roomNumber}?`,
      message: `Room ${r.roomNumber} and its lockers, cupboards and study tables are removed from ${hostelName}. A room with current or upcoming residents can't be removed.`,
      confirmLabel: "Remove room"
    });
    if (ok) remove.mutate(r.id, { onSuccess: res => toast.success(res.message || `Room ${r.roomNumber} removed`), onError: e => toast.error(e) });
  };

  const addButton = canManage && (
    <Button size="sm" icon={<Plus />} onClick={() => setDrawer({ room: null })}>
      Add room
    </Button>
  );

  const columns: Column<Room>[] = [
    { key: "roomNumber", header: "Room", render: r => <strong>{r.roomNumber}</strong> },
    { key: "floor", header: "Floor", render: r => floorLabel(r.floor) },
    { key: "roomType", header: "Type", render: r => r.roomType || <span className="muted">—</span> },
    { key: "beds", header: "Beds", align: "right", render: r => `${r.occupied} / ${r.capacity}` },
    { key: "freeBeds", header: "Free beds", render: r => (r.freeBeds.length ? r.freeBeds.join(", ") : <span className="muted">None</span>) },
    { key: "fee", header: "Fee", align: "right", render: r => (r.monthlyFee ? formatMoney(r.monthlyFee, currency) : <span className="muted">—</span>) },
    { key: "status", header: "Status", render: r => <RoomStatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: r =>
        canManage && (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ room: r })} aria-label={`Edit room ${r.roomNumber}`} title="Edit" />
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for room ${r.roomNumber}`} title="More" />}>
              {close => (
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
            </Menu>
          </div>
        )
    }
  ];

  return (
    <Card flush title="Rooms" subtitle="Beds and free bed numbers are for today. Maintenance keeps residents but takes no new ones." actions={addButton}>
      <div className="filter-bar">
        <Select
          label="Status"
          className="select-sm"
          value={params.status}
          onChange={e => setParam("status", e.target.value)}
          placeholder="All statuses"
          options={ROOM_STATUSES.map(s => ({ value: s, label: ROOM_STATUS_LABELS[s] }))}
        />
        <Select
          label="Floor"
          className="select-sm"
          value={params.floor}
          onChange={e => setParam("floor", e.target.value)}
          placeholder="All floors"
          options={floors.map(f => ({ value: String(f), label: floorLabel(f) }))}
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
        onRowClick={r => setDrawer({ room: r })}
        empty={
          params.status || params.floor ? (
            <EmptyState icon={<DoorOpen />} title="No rooms match these filters" />
          ) : (
            <EmptyState icon={<DoorOpen />} title="No rooms yet" message="Add the hostel's rooms with their number of beds." actions={addButton} />
          )
        }
      />
      <RoomDrawer open={!!drawer} hostelId={hostelId} room={drawer?.room ?? null} roomTypes={roomTypes} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Card>
  );
}
