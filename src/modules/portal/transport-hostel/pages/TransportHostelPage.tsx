import { BedDouble, Bus, Phone } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Badge, Card, DescriptionList, EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { enumLabel, formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { studentFullName } from "../../shared/api/students";
import { formatClock } from "../../shared/utils/time";
import { useMyHostel, useMyTransport, type HostelStay, type MyHostel, type MyTransport } from "../api/transportHostel";

function CallLine({ role, person }: { role: string; person: { name: string | null; phone: string | null } | null }) {
  if (!person?.name && !person?.phone) return null;
  return (
    <div className="po-contact">
      <div style={{ minWidth: 0 }}>
        <div className="small muted">{role}</div>
        <div>{person.name ?? "—"}</div>
      </div>
      {person.phone && (
        <a className="btn btn-sm" href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>
          <Phone />
          {person.phone}
        </a>
      )}
    </div>
  );
}

/* PO-08 · Transport and hostel: the child's bus seat and hostel bed. Each card hides when the
   school doesn't use that module (no child has a seat or bed and the call is closed to them). */
export default function TransportHostelPage() {
  const { student } = usePortalStudent();
  const { can } = useAuth();
  const transport = useMyTransport();
  const hostel = useMyHostel();

  /* Decide which cards to show once both calls are settled, so a card never vanishes under the reader */
  const settled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus === "idle";
  const ready = settled(transport) && settled(hostel);
  /* A card hides when the school doesn't use that module: nobody the caller can see has a seat (or a bed) */
  const showTransport = can("transport.myTransport.read") && (!!transport.error || !!transport.data?.some(t => t.transport));
  const showHostel = can("hostel.myHostel.read") && (!!hostel.error || !!hostel.data?.some(h => h.current || h.upcoming.length || h.resources.length));

  const mine = transport.data?.find(t => t.student.id === student.id);
  const myHostel = hostel.data?.find(h => h.student.id === student.id);

  return (
    <Page>
      <PageHeader title="Transport & hostel" subtitle={studentFullName(student)} />
      {!ready ? (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card title="School transport">
            <SkeletonBlock lines={6} />
          </Card>
          <Card title="Hostel">
            <SkeletonBlock lines={6} />
          </Card>
        </div>
      ) : !showTransport && !showHostel ? (
        <Card>
          <EmptyState icon={<Bus />} title="No school transport or hostel" message="The school doesn't have a bus seat or a hostel place for this student." />
        </Card>
      ) : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          {showTransport && (
            <Card title={<span className="row"><Bus size={18} /> School transport</span>}>
              {transport.error ? <ErrorState error={transport.error} onRetry={() => void transport.refetch()} /> : <TransportBody entry={mine} />}
            </Card>
          )}
          {showHostel && (
            <Card title={<span className="row"><BedDouble size={18} /> Hostel</span>}>
              {hostel.error ? <ErrorState error={hostel.error} onRetry={() => void hostel.refetch()} /> : <HostelBody entry={myHostel} />}
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}

function TransportBody({ entry }: { entry: MyTransport | undefined }) {
  const currency = useSchoolCurrency();
  const t = entry?.transport;
  if (!t) return <EmptyState icon={<Bus />} title="No school transport assigned" message="Ask the transport office if your child should have a seat." />;
  const notUsed = <span className="muted">Not using this leg</span>;
  return (
    <div className="stack">
      <DescriptionList
        columns={2}
        items={[
          { label: "Route", value: `${t.route.name} (${t.route.code})`, wide: true },
          { label: "Stop", value: t.stop.landmark ? `${t.stop.name} · ${t.stop.landmark}` : t.stop.name, wide: true },
          { label: "Pickup", value: t.direction === "DROP_ONLY" || !t.stop.pickupTime ? notUsed : formatClock(t.stop.pickupTime) },
          { label: "Drop", value: t.direction === "PICKUP_ONLY" || !t.stop.dropTime ? notUsed : formatClock(t.stop.dropTime) },
          {
            label: "Bus",
            value: t.vehicle ? (
              <span className="row">
                <span className="mono">{t.vehicle.registrationNumber}</span>
                <span className="muted">{[t.vehicle.make, t.vehicle.model].filter(Boolean).join(" ")}</span>
                {t.vehicle.status !== "ACTIVE" && <Badge tone="warning">{enumLabel(t.vehicle.status)}</Badge>}
              </span>
            ) : null,
            wide: true
          },
          { label: "Monthly fee", value: t.stop.monthlyFee !== null ? formatMoney(t.stop.monthlyFee, currency) : null },
          { label: "Valid", value: `${formatDate(t.startDate)} – ${t.endDate ? formatDate(t.endDate) : "end of the year"}` }
        ]}
      />
      <div>
        <CallLine role="Driver" person={t.driver} />
        <CallLine role="Attendant" person={t.attendant} />
      </div>
    </div>
  );
}

function Stay({ stay }: { stay: HostelStay }) {
  const currency = useSchoolCurrency();
  return (
    <DescriptionList
      columns={2}
      items={[
        { label: "Hostel", value: `${stay.hostel.name} (${stay.hostel.code})`, wide: true },
        { label: "Room", value: [stay.room.roomNumber, stay.room.roomType].filter(Boolean).join(" · ") },
        { label: "Bed", value: String(stay.bedNumber) },
        { label: "From", value: formatDate(stay.fromDate) },
        { label: "To", value: stay.toDate ? formatDate(stay.toDate) : "Until further notice" },
        { label: "Room fee", value: stay.room.monthlyFee !== null ? `${formatMoney(stay.room.monthlyFee, currency)} a month` : null },
        { label: "Address", value: stay.hostel.address, hidden: !stay.hostel.address, wide: true }
      ]}
    />
  );
}

function HostelBody({ entry }: { entry: MyHostel | undefined }) {
  const currency = useSchoolCurrency();
  if (!entry || (!entry.current && !entry.upcoming.length)) return <EmptyState icon={<BedDouble />} title="No hostel place" />;
  const contactStay = entry.current ?? entry.upcoming[0]!;
  return (
    <div className="stack">
      {entry.current ? <Stay stay={entry.current} /> : <p className="muted">No bed right now.</p>}
      <div>
        <CallLine role="Warden" person={contactStay.warden} />
        <CallLine role="Hostel office" person={contactStay.hostel.contactPhone ? { name: contactStay.hostel.name, phone: contactStay.hostel.contactPhone } : null} />
      </div>
      {entry.upcoming.length > 0 && (
        <div className="stack-sm">
          <div className="section-title">Booked ahead</div>
          {entry.upcoming.map(u => (
            <Stay key={u.id} stay={u} />
          ))}
        </div>
      )}
      {entry.resources.length > 0 && (
        <div className="stack-sm">
          <div className="section-title">Also provided</div>
          <ul className="po-lines">
            {entry.resources.map(r => (
              <li key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div>{r.resource.name}</div>
                  <div className="small muted">
                    {r.resource.customType ?? enumLabel(r.resource.resourceType)} · from {formatDate(r.fromDate)}
                    {r.toDate ? ` to ${formatDate(r.toDate)}` : ""}
                    {r.phase !== "CURRENT" ? " · booked ahead" : ""}
                  </div>
                </div>
                {r.resource.monthlyFee !== null && <span className="po-num small">{formatMoney(r.resource.monthlyFee, currency)} a month</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
