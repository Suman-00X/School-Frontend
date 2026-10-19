import { useMemo } from "react";
import { useApiGet } from "@/common/hooks";
import { Select, type Option } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { AVAILABILITY_PATH, type Availability } from "../api/allocations";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* Room and bed for a stay: rooms that take residents, with the beds free for the whole range
   (GET /hostel/bed-availability). Leaving the bed blank takes the lowest one free. */
export function BedFields({
  fromDate,
  toDate,
  roomId,
  bedNumber,
  onRoom,
  onBed,
  errors,
  exclude
}: {
  fromDate: string;
  toDate: string;
  roomId: string;
  bedNumber: string;
  onRoom: (roomId: string) => void;
  onBed: (bed: string) => void;
  errors: { roomId?: string; bedNumber?: string };
  /* The bed being moved from (a transfer): not offered */
  exclude?: { roomId: string; bedNumber: number };
}) {
  const currency = useSchoolCurrency();
  const ready = ISO.test(fromDate) && (!toDate || (ISO.test(toDate) && toDate >= fromDate));
  const q = useApiGet<Availability>(ready ? AVAILABILITY_PATH : null, { fromDate, toDate: toDate || undefined });

  const rooms = useMemo(
    () =>
      (q.data?.hostels ?? []).flatMap(h =>
        h.rooms.map(r => {
          const freeBeds = exclude && exclude.roomId === r.id ? r.freeBeds.filter(b => b !== exclude.bedNumber) : r.freeBeds;
          return { ...r, freeBeds, hostel: h };
        })
      ),
    [q.data, exclude]
  );
  const room = rooms.find(r => r.id === roomId);

  const roomOptions = useMemo<Option[]>(
    () =>
      rooms.map(r => ({
        value: r.id,
        label: `${r.hostel.code} · Room ${r.roomNumber}`,
        description: [
          r.freeBeds.length ? `${r.freeBeds.length} of ${r.capacity} beds free` : "No bed free for the whole stay",
          r.roomType,
          r.monthlyFee ? `${formatMoney(r.monthlyFee, currency)} a month` : null,
          r.hostel.name
        ]
          .filter(Boolean)
          .join(" · "),
        disabled: r.freeBeds.length === 0 && r.id !== roomId
      })),
    [rooms, roomId, currency]
  );

  const bedOptions = useMemo<Option[]>(() => {
    const free = room?.freeBeds ?? [];
    const opts = free.map(b => ({ value: String(b), label: `Bed ${b}` }));
    /* A bed chosen elsewhere (the bed board) stays visible even when it isn't free for the whole stay */
    if (bedNumber && !free.includes(Number(bedNumber))) opts.unshift({ value: bedNumber, label: `Bed ${bedNumber} (taken during this stay)`, disabled: true } as Option);
    return opts;
  }, [room, bedNumber]);

  const bedTaken = !!bedNumber && !!room && !room.freeBeds.includes(Number(bedNumber));

  return (
    <>
      <Select
        label="Room"
        required
        value={roomId}
        onChange={e => onRoom(e.target.value)}
        options={roomOptions}
        searchable
        placeholder={!ready ? "Pick the dates first" : q.isLoading ? "Loading rooms…" : "Pick a room"}
        disabled={!ready}
        error={errors.roomId}
        hint="Rooms that take residents, with the beds free for the whole stay"
      />
      <Select
        label="Bed"
        value={bedNumber}
        onChange={e => onBed(e.target.value)}
        options={bedOptions}
        placeholder="Lowest bed free"
        disabled={!room}
        error={errors.bedNumber ?? (bedTaken ? `Bed ${bedNumber} is booked during these dates; pick another or leave it blank` : undefined)}
        hint="Blank takes the lowest bed free for the whole stay"
      />
    </>
  );
}
