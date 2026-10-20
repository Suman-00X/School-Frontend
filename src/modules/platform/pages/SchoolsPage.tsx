import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useDebounce } from "@/common/hooks";
import { Badge, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, SearchInput, StatusBadge, Tabs, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useModuleCatalogue, useSchools, type SchoolStatus, type SchoolSummary } from "../api/schools";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "SUSPENDED", label: "Suspended" }
];

/* PL-02. Every school on the platform, newest first */
export default function SchoolsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debounced = useDebounce(search.trim(), 250);
  const schools = useSchools({
    ...(debounced && { search: debounced }),
    ...(status !== "all" && { status: status as SchoolStatus })
  });
  const catalogue = useModuleCatalogue();
  const addOns = (catalogue.data ?? []).filter(m => !m.core);
  const labelOf = (key: string) => addOns.find(m => m.key === key)?.label ?? key;

  const columns: Column<SchoolSummary>[] = [
    {
      key: "name",
      header: "School",
      render: s => (
        <span className="school-cell">
          <span className="school-cell-name">{s.name}</span>
          <span className="small muted mono">{s.code}</span>
        </span>
      )
    },
    {
      key: "modules",
      header: "Add-on modules",
      render: s => {
        const on = addOns.filter(m => s.modules.includes(m.key)).map(m => m.key);
        if (!on.length) return <span className="muted">Core only</span>;
        if (on.length === addOns.length) return <Badge tone="primary">All modules</Badge>;
        return (
          <span className="module-chips">
            {on.map(key => (
              <Badge key={key}>{labelOf(key)}</Badge>
            ))}
          </span>
        );
      }
    },
    { key: "status", header: "Status", width: 120, render: s => <StatusBadge status={s.status} /> },
    { key: "createdAt", header: "Onboarded", width: 130, render: s => formatDate(s.createdAt) }
  ];

  const filtered = !!debounced || status !== "all";

  return (
    <Page>
      <PageHeader
        title="Schools"
        subtitle="Schools on the platform, with the modules each one uses"
        actions={
          <ButtonLink to="/platform/schools/new" variant="primary" icon={<Plus size={15} />}>
            Onboard a school
          </ButtonLink>
        }
      />
      <Card flush>
        <div className="platform-toolbar">
          <SearchInput placeholder="Search by name or code" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search schools" />
          <Tabs tabs={STATUS_TABS} value={status} onChange={setStatus} />
        </div>
        <DataTable
          columns={columns}
          rows={schools.data}
          rowKey={s => s.id}
          loading={schools.isPending}
          error={schools.error}
          onRetry={() => void schools.refetch()}
          onRowClick={s => navigate(`/platform/schools/${s.id}`)}
          empty={
            filtered ? (
              <EmptyState title="No schools match" message="Try another name or code, or clear the filter." />
            ) : (
              <EmptyState
                icon={<Building2 />}
                title="No schools yet"
                message="Onboard the first school: its details, its administrator and the modules it will use."
                actions={
                  <ButtonLink to="/platform/schools/new" variant="primary" icon={<Plus size={15} />}>
                    Onboard a school
                  </ButtonLink>
                }
              />
            )
          }
        />
      </Card>
    </Page>
  );
}
