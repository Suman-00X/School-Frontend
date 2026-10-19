import { Fragment, useMemo, useState } from "react";
import { BedDouble, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, Select, SkeletonBlock, TextInput } from "@/common/ui";
import { formatDate, formatMoney, todayIso } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { floorLabel } from "../../shared/utils/format";
import { useAllHostels } from "../../hostels/api/hostels";
import { AVAILABILITY_PATH, type Availability } from "../api/allocations";
import type { AllocatePrefill } from "./AllocateDrawer";
import "../../shared/components/hostel.css";

const NO_TYPE = "—";

/* HO-02 availability view: beds free for the whole of a date range, per hostel and room type,
   expandable to rooms with their free bed numbers. "Book" opens Allocate for that room and range. */
export function AvailabilityView({ onBook }: { onBook: (p: AllocatePrefill) => void }) {
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const today = todayIso();
  const { params, setParam, setParams } = useListParams({ freeFrom: "", freeTo: "", hostelId: "", roomType: "" });
  const from = params.freeFrom || today;
  const valid = !params.freeTo || params.freeTo >= from;
  const q = useApiGet<Availability>(valid ? AVAILABILITY_PATH : null, {
    fromDate: from,
    toDate: params.freeTo || undefined,
    hostelId: params.hostelId || undefined,
    roomType: params.roomType || undefined
  });
  const hostels = useAllHostels(can("hostel.hostels.read"));
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const canBook = can("hostel.allocations.manage");

  /* Room types seen so far (kept while a type filter narrows the result) */
  const [seenTypes, setSeenTypes] = useState<string[]>([]);
  const types = useMemo(() => {
    const now = new Set(seenTypes);
    for (const h of q.data?.hostels ?? []) for (const r of h.rooms) if (r.roomType) now.add(r.roomType);
    return [...now].sort();
  }, [q.data, seenTypes]);
  if (types.length !== seenTypes.length) setSeenTypes(types);

  const toggle = (key: string) =>
    setOpenRows(s => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const d = q.data;

  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar" style={{ borderBottom: 0 }}>
          <TextInput label="Free from" type="date" className="input-sm" value={from} onChange={e => setParam("freeFrom", e.target.value === today ? "" : e.target.value)} />
          <TextInput label="Until" type="date" className="input-sm" min={from} value={params.freeTo} onChange={e => setParam("freeTo", e.target.value)} />
          {can("hostel.hostels.read") && (
            <Select
              label="Hostel"
              className="select-sm"
              value={params.hostelId}
              onChange={e => setParam("hostelId", e.target.value)}
              placeholder="All hostels"
              options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
            />
          )}
          <Select
            label="Room type"
            className="select-sm"
            value={params.roomType}
            onChange={e => setParam("roomType", e.target.value)}
            placeholder="All types"
            options={types.map(t => ({ value: t, label: t }))}
          />
        </div>
      </Card>

      {!valid ? (
        <EmptyState icon={<BedDouble />} title="The end is before the start" actions={<Button onClick={() => setParams({ freeTo: "" })}>Clear the end date</Button>} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : (
        <>
          <p className="small muted">
            {d.totals.free} of {d.totals.capacity} beds free for the whole stay from {formatDate(d.fromDate)}
            {d.toDate ? ` to ${formatDate(d.toDate)}` : " with no end date"}, in {d.totals.rooms} rooms that take residents.
          </p>
          {!d.hostels.length && <EmptyState icon={<BedDouble />} title="No rooms take residents for these filters" />}
          {d.hostels.map(h => (
            <Card key={h.id} flush title={`${h.name} (${h.code})`} subtitle={`${h.free} of ${h.capacity} beds free`}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} />
                      <th>Room type</th>
                      <th className="align-right">Rooms</th>
                      <th className="align-right">Beds</th>
                      <th className="align-right">Free</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.byRoomType.map(t => {
                      const key = `${h.id}|${t.roomType ?? NO_TYPE}`;
                      const expanded = openRows.has(key);
                      const rooms = h.rooms.filter(r => (r.roomType ?? null) === t.roomType);
                      return (
                        <Fragment key={key}>
                          <tr className="clickable" onClick={() => toggle(key)} aria-expanded={expanded}>
                            <td>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                            <td>
                              <strong>{t.roomType ?? "No type"}</strong>
                            </td>
                            <td className="align-right">{t.rooms}</td>
                            <td className="align-right">{t.capacity}</td>
                            <td className="align-right">{t.free}</td>
                          </tr>
                          {expanded &&
                            rooms.map(r => (
                              <tr key={r.id}>
                                <td />
                                <td colSpan={2}>
                                  Room {r.roomNumber} <span className="muted small">· {floorLabel(r.floor)}</span>
                                  {r.monthlyFee ? <span className="muted small"> · {formatMoney(r.monthlyFee, currency)} a month</span> : null}
                                </td>
                                <td className="align-right">
                                  {r.freeBeds.length ? (
                                    <span className="avail-rooms" style={{ justifyContent: "flex-end" }}>
                                      Beds {r.freeBeds.join(", ")}
                                    </span>
                                  ) : (
                                    <span className="muted">None free</span>
                                  )}
                                </td>
                                <td className="align-right">
                                  {canBook && r.freeBeds.length > 0 && (
                                    <Button size="sm" onClick={() => onBook({ roomId: r.id, fromDate: from, toDate: params.freeTo || undefined })}>
                                      Book
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
