import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LayoutGrid, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Button, ButtonLink, Card, DescriptionList, ErrorState, Kpi, Page, PersonCell, RoleBadge, Skeleton, useConfirm, useTabParam, useToast, type TabItem } from "@/common/ui";
import { GenderBadge } from "../../shared/components/Badges";
import { Fact } from "../../shared/components/Facts";
import { RoomsPanel } from "../../rooms/components/RoomsPanel";
import { HOSTELS_PATH, removeHostel, useOccupancy, wardenName, type Hostel } from "../api/hostels";
import { HostelDrawer } from "../components/HostelDrawer";
import "../../shared/components/hostel.css";

/* HO-01 · Hostel: header (code, residents, warden, actions), then Overview and Rooms tabs */
export default function HostelDetailPage() {
  const { hostelId = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const q = useApiGet<Hostel>(`${HOSTELS_PATH}/${hostelId}`);
  const occ = useOccupancy(hostelId);
  const remove = useApiMutation(removeHostel, { invalidate: ["/hostel"] });
  const [editing, setEditing] = useState(false);

  const tabs: TabItem[] = [
    { id: "overview", label: "Overview" },
    { id: "rooms", label: "Rooms", count: occ.data?.totals.rooms, hidden: !can("hostel.rooms.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const h = q.data;
  const t = occ.data?.totals;
  const canManage = can("hostel.hostels.manage");

  const header = (
    <DrillHeader
      back="/hostel/hostels"
      backLabel="Back to hostels"
      title={<span style={{ display: "inline-block", width: "min(240px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{h?.name ?? ""}</span>}
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );

  const askRemove = async () => {
    if (!h) return;
    const ok = await confirm({
      title: `Remove ${h.name}?`,
      message: `${h.name} (${h.code}) is removed with all its rooms and resources. A hostel with current or upcoming residents can't be removed: vacate, cancel or transfer them first.`,
      confirmLabel: "Remove hostel"
    });
    if (ok)
      remove.mutate(h.id, {
        onSuccess: res => {
          toast.success(res.message || `${h.name} removed`);
          navigate("/hostel/hostels");
        },
        onError: e => toast.error(e)
      });
  };

  return (
    <Page>
      {header}
      <Card>
        <div className="row-between" style={{ gap: 16, alignItems: "center" }}>
          <div className="facts" style={{ minHeight: 44 }}>
            <Fact label="Code" value={h ? <strong className="mono">{h.code}</strong> : undefined} />
            <Fact label="Residents" value={h ? <GenderBadge gender={h.residentGender} /> : undefined} />
            <Fact label="Warden" value={h ? (h.warden ? wardenName(h.warden) : <span className="muted">No warden</span>) : undefined} />
            <Fact label="Beds taken today" value={occ.isLoading ? undefined : t ? `${t.occupied} of ${t.capacity}` : "—"} />
          </div>
          <div className="row">
            {can("hostel.allocations.read") && (
              <ButtonLink icon={<LayoutGrid />} to={`/hostel/allocations?hostelId=${hostelId}`}>
                Bed board
              </ButtonLink>
            )}
            {canManage && (
              <>
                <Button icon={<Pencil />} disabled={!h} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button icon={<Trash2 />} variant="ghost" disabled={!h} onClick={() => void askRemove()} aria-label="Remove hostel" title="Remove hostel" />
              </>
            )}
          </div>
        </div>
      </Card>

      {tab === "rooms" && h ? (
        <RoomsPanel hostelId={h.id} hostelName={h.name} />
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Rooms" value={t ? t.rooms : <Skeleton width={40} height={24} />} />
            <Kpi label="Beds" value={t ? t.capacity : <Skeleton width={40} height={24} />} />
            <Kpi label="Occupied today" value={t ? t.occupied : <Skeleton width={40} height={24} />} />
            <Kpi label="Free today" value={t ? t.free : <Skeleton width={40} height={24} />} />
            <Kpi label="Allocatable now" value={t ? t.allocatable : <Skeleton width={40} height={24} />} hint="Free beds in rooms that take residents" />
          </div>
          <div className="grid-2">
            <Card title="Hostel">
              {h ? (
                <DescriptionList
                  columns={1}
                  items={[
                    { label: "Address", value: h.address },
                    { label: "Hostel phone", value: h.contactPhone },
                    { label: "Description", value: h.description }
                  ]}
                />
              ) : (
                <Skeleton height={80} />
              )}
            </Card>
            <Card title="Warden" subtitle="Responsible for the hostel. Change it here, or by a handover in Admin › Access control.">
              {!h ? (
                <Skeleton height={80} />
              ) : h.warden ? (
                <div className="stack-sm">
                  <PersonCell name={wardenName(h.warden)} extra={<RoleBadge role={h.warden.role} />} />
                  <div className="row small" style={{ gap: 16 }}>
                    <a className="row" style={{ gap: 4 }} href={`mailto:${h.warden.email}`}>
                      <Mail size={14} /> {h.warden.email}
                    </a>
                    {h.warden.phone && (
                      <a className="row" style={{ gap: 4 }} href={`tel:${h.warden.phone.replace(/\s/g, "")}`}>
                        <Phone size={14} /> {h.warden.phone}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="muted">No warden yet.</p>
              )}
            </Card>
          </div>
        </>
      )}

      {h && <HostelDrawer open={editing} hostel={h} onClose={() => setEditing(false)} />}
    </Page>
  );
}
