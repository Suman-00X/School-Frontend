import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Lock, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, PersonCell, Select, Tabs, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { PhaseBadge } from "../../shared/components/Badges";
import { PageIntro } from "../../shared/components/PageIntro";
import { END_REASON_LABELS, PHASE_LABELS, PHASES, resourceTypeLabel, studentName } from "../../shared/utils/format";
import { useAllHostels } from "../../hostels/api/hostels";
import { RESOURCES_PATH, type Resource } from "../../resources/api/resources";
import { RESOURCE_ASSIGNMENTS_PATH, type ResourceAssignment } from "../api/resourceAssignments";
import { GiveResourceDrawer } from "../components/GiveResourceDrawer";
import { ResourceAssignmentDrawer } from "../components/ResourceAssignmentDrawer";

const columns: Column<ResourceAssignment>[] = [
  { key: "resource", header: "Resource", render: a => <strong>{a.resource.name}</strong> },
  { key: "type", header: "Type", render: a => resourceTypeLabel(a.resource) },
  { key: "student", header: "Student", render: a => <PersonCell name={studentName(a.student)} sub={a.student.admissionNumber} /> },
  { key: "bed", header: "Bed", render: a => (a.allocation ? `Bed ${a.allocation.bedNumber}` : <span className="muted">—</span>) },
  { key: "from", header: "From", render: a => <span className="nowrap">{formatDate(a.fromDate)}</span> },
  { key: "to", header: "To", render: a => (a.toDate ? <span className="nowrap">{formatDate(a.toDate)}</span> : <span className="muted">No end</span>) },
  { key: "phase", header: "Phase", render: a => <PhaseBadge phase={a.phase} /> },
  { key: "endReason", header: "End reason", render: a => (a.endReason ? (END_REASON_LABELS[a.endReason] ?? a.endReason) : <span className="muted">—</span>) }
];

const PATH = "/hostel/resource-assignments";

/* HO-04 · Resource assignments: who holds which locker, cupboard, table or plan, and when.
   /hostel/resource-assignments/:assignmentId opens one in the drawer; ?new=1 opens "Give resource". */
export default function ResourceAssignmentsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { assignmentId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { params, setParam, setParams, setPage } = useListParams({ phase: "CURRENT", hostelId: "", resourceId: "", studentId: "", activeOn: "" });
  const list = useApiList<ResourceAssignment>(RESOURCE_ASSIGNMENTS_PATH, { ...params, phase: params.phase === "ALL" ? undefined : params.phase });
  const hostels = useAllHostels(can("hostel.hostels.read"));
  const resources = useApiList<Resource>(RESOURCES_PATH, { hostelId: params.hostelId || undefined, limit: 100 }, { enabled: can("hostel.resources.read") });
  const canManage = can("hostel.resourceAssignments.manage");

  const giving = canManage && search.get("new") === "1";
  const setGiving = (on: boolean) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        if (on) next.set("new", "1");
        else next.delete("new");
        return next;
      },
      { replace: true }
    );
  const openOne = (id: string | null) => {
    const qs = new URLSearchParams(location.search);
    qs.delete("new");
    navigate({ pathname: id ? `${PATH}/${id}` : PATH, search: qs.toString() });
  };

  const giveButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setGiving(true)}>
      Give resource
    </Button>
  );
  const filtered = !!(params.hostelId || params.resourceId || params.studentId || params.activeOn);

  return (
    <Page>
      <PageIntro actions={giveButton}>Who holds which locker, cupboard, study table or plan, and for which dates.</PageIntro>
      <Card flush>
        <div style={{ padding: "0 14px" }}>
          <Tabs tabs={[...PHASES.map(p => ({ id: p, label: PHASE_LABELS[p] })), { id: "ALL", label: "All" }]} value={params.phase} onChange={id => setParam("phase", id)} />
        </div>
        <div className="filter-bar">
          {can("hostel.hostels.read") && (
            <Select
              label="Hostel"
              className="select-sm"
              value={params.hostelId}
              onChange={e => setParams({ hostelId: e.target.value, resourceId: "" })}
              placeholder="All hostels"
              options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
            />
          )}
          {can("hostel.resources.read") && (
            <Select
              label="Resource"
              className="select-sm"
              fieldClassName="filter-wide"
              searchable
              value={params.resourceId}
              onChange={e => setParam("resourceId", e.target.value)}
              placeholder="All resources"
              options={(resources.rows ?? []).map(r => ({ value: r.id, label: r.name, description: `${resourceTypeLabel(r)} · ${r.hostel.code}` }))}
            />
          )}
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="All students" />
          <TextInput label="Holding on" type="date" className="input-sm" value={params.activeOn} onChange={e => setParam("activeOn", e.target.value)} />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={a => openOne(a.id)}
          empty={
            <EmptyState
              icon={<Lock />}
              title={filtered ? "Nothing matches these filters" : params.phase === "ALL" ? "No resources given out yet" : `No ${PHASE_LABELS[params.phase as keyof typeof PHASE_LABELS]?.toLowerCase() ?? ""} assignments`}
              actions={filtered ? <Button onClick={() => setParams({ hostelId: "", resourceId: "", studentId: "", activeOn: "" })}>Clear filters</Button> : giveButton}
            />
          }
        />
      </Card>
      <GiveResourceDrawer open={giving} prefill={{ resourceId: params.resourceId || undefined, studentId: params.studentId || undefined }} onClose={() => setGiving(false)} />
      <ResourceAssignmentDrawer id={assignmentId ?? null} onClose={() => openOne(null)} />
    </Page>
  );
}
