import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, PersonCell, Select, Skeleton, type Column } from "@/common/ui";
import { GenderBadge } from "../../shared/components/Badges";
import { BedsUsed } from "../../shared/components/Facts";
import { PageIntro } from "../../shared/components/PageIntro";
import { GENDER_LABELS, RESIDENT_GENDERS } from "../../shared/utils/format";
import { HOSTELS_PATH, useOccupancy, wardenName, type Hostel } from "../api/hostels";
import { HostelDrawer } from "../components/HostelDrawer";

/* Today's beds used in one hostel (a hostel list is short: one small call per row) */
function BedsCell({ hostelId }: { hostelId: string }) {
  const occ = useOccupancy(hostelId);
  if (occ.isLoading) return <Skeleton width={90} />;
  if (!occ.data) return <span className="muted">—</span>;
  return occ.data.totals.capacity ? <BedsUsed occupied={occ.data.totals.occupied} capacity={occ.data.totals.capacity} /> : <span className="muted">No rooms</span>;
}

/* HO-01 · Hostels: the list (then a page per hostel with its rooms) */
export default function HostelsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParam, setPage } = useListParams({ residentGender: "" });
  const list = useApiList<Hostel>(HOSTELS_PATH, params);
  const [creating, setCreating] = useState(false);
  const canManage = can("hostel.hostels.manage");

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      New hostel
    </Button>
  );

  const columns: Column<Hostel>[] = [
    { key: "code", header: "Code", width: 100, render: h => <strong className="mono">{h.code}</strong> },
    { key: "name", header: "Name", render: h => h.name },
    { key: "residentGender", header: "Residents", render: h => <GenderBadge gender={h.residentGender} /> },
    {
      key: "warden",
      header: "Warden",
      render: h => (h.warden ? <PersonCell name={wardenName(h.warden)} sub={h.warden.phone ?? undefined} /> : <span className="muted">No warden</span>)
    },
    { key: "contactPhone", header: "Hostel phone", render: h => (h.contactPhone ? <span className="nowrap">{h.contactPhone}</span> : <span className="muted">—</span>) },
    { key: "beds", header: "Beds used today", render: h => <BedsCell hostelId={h.id} /> }
  ];

  return (
    <Page>
      <PageIntro actions={newButton}>Boarding houses, their wardens, rooms and beds.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Residents"
            className="select-sm"
            value={params.residentGender}
            onChange={e => setParam("residentGender", e.target.value)}
            placeholder="All hostels"
            options={RESIDENT_GENDERS.map(g => ({ value: g, label: GENDER_LABELS[g] }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={h => h.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={h => navigate(`/hostel/hostels/${h.id}`)}
          empty={
            params.residentGender ? (
              <EmptyState icon={<Building2 />} title={`No ${GENDER_LABELS[params.residentGender as keyof typeof GENDER_LABELS]?.toLowerCase() ?? ""} hostels`} />
            ) : (
              <EmptyState icon={<Building2 />} title="No hostels yet" message="Add a hostel, then its rooms; beds are numbered from the room's capacity." actions={newButton} />
            )
          }
        />
      </Card>
      <HostelDrawer open={creating} hostel={null} onClose={() => setCreating(false)} />
    </Page>
  );
}
