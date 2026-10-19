import { useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiGet } from "@/common/hooks";
import { Button, DescriptionList, Drawer, ErrorState, SkeletonBlock, StatusBadge } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { directionLabel, hhmm, routeLabel } from "../../shared/utils/format";
import { ASSIGNMENTS_PATH, riderName, type SeatAssignment } from "../api/assignments";
import { ChangeSeatDialog, EndSeatDialog } from "./SeatDialogs";

/* TR-03 drawer: one seat assignment, the seat it replaced, and Change / End while active */
export function AssignmentDrawer({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const currency = useSchoolCurrency();
  const q = useApiGet<SeatAssignment>(id ? `${ASSIGNMENTS_PATH}/${id}` : null);
  const [changing, setChanging] = useState<SeatAssignment | null>(null);
  const [ending, setEnding] = useState<SeatAssignment | null>(null);
  const a = q.data;
  const canManage = can("transport.assignments.manage") && !readOnly;
  const active = a?.status === "ACTIVE";

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={a ? riderName(a) : "Seat"}
        subtitle={
          <span className="row" style={{ gap: 8, minHeight: 22 }}>
            {a ? (
              <>
                <span className="mono">{a.student.admissionNumber}</span>
                <StatusBadge status={a.status} />
              </>
            ) : (
              <span className="skeleton" style={{ display: "inline-block", width: 140, height: 12 }} />
            )}
          </span>
        }
        /* The footer depends on the permission only, so it is there while the seat loads */
        footerStatus={canManage && a && !active ? <span className="muted">Ended on {formatDate(a.endDate)}</span> : null}
        footer={
          canManage ? (
            a && !active ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                <Button variant="danger" disabled={!a} onClick={() => a && setEnding(a)}>
                  End seat
                </Button>
                <Button variant="primary" disabled={!a} onClick={() => a && setChanging(a)}>
                  Change route or stop
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !a ? (
          <SkeletonBlock lines={8} />
        ) : (
          <div className="stack">
            <DescriptionList
              items={[
                { label: "Student code", value: <span className="mono">{a.student.studentCode}</span> },
                { label: "Admission number", value: <span className="mono">{a.student.admissionNumber}</span> },
                {
                  label: "Route",
                  value: (
                    <Link to={`/transport/routes/${a.route.id}`}>
                      {routeLabel(a.route)} · {a.route.name}
                    </Link>
                  ),
                  wide: true
                },
                { label: "Stop", value: `${a.stop.sequence}. ${a.stop.name}` },
                { label: "Landmark", value: a.stop.landmark },
                { label: "Pickup", value: hhmm(a.stop.pickupTime) },
                { label: "Drop", value: hhmm(a.stop.dropTime) },
                { label: "Direction", value: directionLabel(a.direction) },
                { label: "Stop fee", value: a.stop.monthlyFee ? `${formatMoney(a.stop.monthlyFee, currency)} a month` : null },
                { label: "From", value: formatDate(a.startDate) },
                { label: "To", value: a.endDate ? formatDate(a.endDate) : active ? "Open" : null },
                { label: "Notes", value: a.notes, wide: true }
              ]}
            />
            {a.previousAssignmentId && (
              <div className="row small muted" style={{ gap: 6 }}>
                <History size={14} />
                Replaced an earlier seat.
                <Button variant="link" onClick={() => onOpen(a.previousAssignmentId!)}>
                  Open the earlier seat
                </Button>
              </div>
            )}
            {readOnly && active && can("transport.assignments.manage") && (
              <p className="small muted">The selected year is archived: seats in it can't be changed here.</p>
            )}
          </div>
        )}
      </Drawer>
      <ChangeSeatDialog assignment={changing} onClose={() => setChanging(null)} onDone={next => onOpen(next.id)} />
      <EndSeatDialog assignment={ending} onClose={() => setEnding(null)} />
    </>
  );
}
