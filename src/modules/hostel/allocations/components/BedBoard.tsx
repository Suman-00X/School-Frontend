import { useEffect, useMemo } from "react";
import { BedDouble } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { Card, EmptyState, ErrorState, Kpi, Select, Skeleton, TextInput } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { RoomStatusBadge } from "../../shared/components/Badges";
import { floorLabel } from "../../shared/utils/format";
import { useAllHostels, useOccupancy, type Occupancy } from "../../hostels/api/hostels";
import type { AllocatePrefill } from "./AllocateDrawer";
import "../../shared/components/hostel.css";

type Room = Occupancy["rooms"][number];

/* HO-02 bed board: one hostel on one day, rooms grouped by floor, a tile per bed.
   An occupied tile opens the allocation; a free tile in an available room opens "Allocate". */
export function BedBoard({ onOpen, onAllocate }: { onOpen: (allocationId: string) => void; onAllocate: (prefill: AllocatePrefill) => void }) {
  const { can } = useAuth();
  const { params, setParam } = useListParams({ hostelId: "", on: "" });
  const hostels = useAllHostels();
  const today = todayIso();
  const on = params.on || today;
  const occ = useOccupancy(params.hostelId || null, params.on || undefined);
  const canAllocate = can("hostel.allocations.manage");

  /* Open on the first hostel */
  const first = hostels.rows?.[0]?.id;
  useEffect(() => {
    if (!params.hostelId && first) setParam("hostelId", first);
  }, [params.hostelId, first, setParam]);

  const floors = useMemo(() => {
    const byFloor = new Map<number | null, Room[]>();
    for (const r of occ.data?.rooms ?? []) byFloor.set(r.floor, [...(byFloor.get(r.floor) ?? []), r]);
    return [...byFloor.entries()]
      .sort(([a], [b]) => (a ?? 9999) - (b ?? 9999))
      .map(([floor, rooms]) => ({ floor, rooms: rooms.sort((x, y) => x.roomNumber.localeCompare(y.roomNumber, undefined, { numeric: true })) }));
  }, [occ.data]);

  const t = occ.data?.totals;
  const kpi = (v: number | undefined) => (v === undefined ? <Skeleton width={40} height={24} /> : v);

  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar" style={{ borderBottom: 0 }}>
          <Select
            label="Hostel"
            className="select-sm"
            fieldClassName="filter-wide"
            required
            value={params.hostelId}
            onChange={e => setParam("hostelId", e.target.value)}
            placeholder={hostels.isLoading ? "Loading hostels…" : "Pick a hostel"}
            options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
          />
          <TextInput label="On" type="date" className="input-sm" value={on} onChange={e => setParam("on", e.target.value === today ? "" : e.target.value)} />
        </div>
      </Card>
      <div className="kpis">
        <Kpi label="Rooms" value={kpi(t?.rooms)} />
        <Kpi label="Beds" value={kpi(t?.capacity)} />
        <Kpi label="Occupied" value={kpi(t?.occupied)} />
        <Kpi label="Free" value={kpi(t?.free)} />
        <Kpi label="Allocatable" value={kpi(t?.allocatable)} hint="Free in rooms that take residents" />
      </div>
      {!params.hostelId && !hostels.isLoading ? (
        <EmptyState icon={<BedDouble />} title="No hostels yet" message="Add a hostel and its rooms first." />
      ) : occ.error ? (
        <ErrorState error={occ.error} onRetry={() => void occ.refetch()} />
      ) : !occ.data ? (
        <Card>
          <Skeleton height={160} />
        </Card>
      ) : !floors.length ? (
        <EmptyState icon={<BedDouble />} title="This hostel has no rooms yet" />
      ) : (
        floors.map(f => (
          <section key={String(f.floor)} className="board-floor">
            <div className="section-title">{floorLabel(f.floor)}</div>
            <div className="board-rooms">
              {f.rooms.map(r => (
                <RoomCard key={r.id} room={r} on={on} canAllocate={canAllocate} onOpen={onOpen} onAllocate={onAllocate} />
              ))}
            </div>
          </section>
        ))
      )}
      {occ.data && <p className="small muted">Showing {formatDate(occ.data.on)}. A free bed may be booked on a later day; allocating checks the whole stay.</p>}
    </div>
  );
}

function RoomCard({
  room,
  on,
  canAllocate,
  onOpen,
  onAllocate
}: {
  room: Room;
  on: string;
  canAllocate: boolean;
  onOpen: (id: string) => void;
  onAllocate: (p: AllocatePrefill) => void;
}) {
  const off = room.status !== "AVAILABLE";
  const byBed = new Map(room.occupants.map(o => [o.bedNumber, o]));
  return (
    <div className={`room-card${off ? " is-off" : ""}`}>
      <div className="room-card-head">
        <span className="room-card-title" title={room.roomType ?? undefined}>
          Room {room.roomNumber}
          {room.roomType && <span className="muted small"> · {room.roomType}</span>}
        </span>
        {off ? <RoomStatusBadge status={room.status} /> : <span className="small muted nowrap">{room.occupied} / {room.capacity}</span>}
      </div>
      <div className="bed-tiles">
        {Array.from({ length: room.capacity }, (_, i) => i + 1).map(bed => {
          const o = byBed.get(bed);
          if (o)
            return (
              <button key={bed} type="button" className="bed-tile is-taken" onClick={() => onOpen(o.allocationId)} title={`${o.student.name} (${o.student.studentCode})`}>
                <span className="bed-tile-num">Bed {bed}</span>
                <span className="bed-tile-name">{o.student.name}</span>
                <span className="small">{o.toDate ? `until ${formatDate(o.toDate)}` : "no end date"}</span>
              </button>
            );
          if (canAllocate && !off)
            return (
              <button key={bed} type="button" className="bed-tile is-free" onClick={() => onAllocate({ roomId: room.id, bedNumber: bed, fromDate: on })} title={`Allocate bed ${bed}`}>
                <span className="bed-tile-num">Bed {bed}</span>
                <span>Free</span>
              </button>
            );
          return (
            <div key={bed} className="bed-tile is-free">
              <span className="bed-tile-num">Bed {bed}</span>
              <span>Free</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
