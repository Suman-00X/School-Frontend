import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useDebounce, useListParams } from "@/common/hooks";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, SearchInput, Select, StatusBadge, Tabs, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useModuleCatalogue, useSchools, type SchoolSort, type SchoolStatus, type SchoolSummary } from "../api/schools";

const SORTS: { value: SchoolSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "students", label: "Most students" }
];

const number = (n: number) => n.toLocaleString();

/* PL-02. Every tenant (school) on the platform: search by name or code, filter by status
   and module, sort; the filters are kept in the URL */
export default function SchoolsPage() {
  const navigate = useNavigate();
  const { params, setParams, setPage } = useListParams({ search: "", status: "", module: "", sort: "newest" });
  const [search, setSearch] = useState(params.search);
  const debounced = useDebounce(search.trim(), 250);
  useEffect(() => {
    if (debounced !== params.search) setParams({ search: debounced });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const schools = useSchools({
    ...(params.search && { search: params.search }),
    ...(params.status && { status: params.status as SchoolStatus }),
    ...(params.module && { module: params.module }),
    sort: params.sort as SchoolSort,
    page: params.page,
    limit: params.limit
  });
  const catalogue = useModuleCatalogue();
  const addOns = (catalogue.data ?? []).filter(m => !m.core);
  const labelOf = (key: string) => addOns.find(m => m.key === key)?.label ?? key;
  const counts = schools.data?.meta.statusCounts;

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
      key: "students",
      header: "Students",
      align: "right",
      width: 110,
      render: s => (s.studentCount === null ? <span className="muted">—</span> : number(s.studentCount))
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

  const filtered = !!params.search || !!params.status || !!params.module;
  const clear = () => {
    setSearch("");
    setParams({ search: "", status: "", module: "" });
  };

  return (
    <Page>
      <PageHeader
        title="Tenants"
        subtitle="Every school on the platform, with the students it is charged for and the modules it uses"
        actions={
          <ButtonLink to="/adminConsole/tenants/new" variant="primary" icon={<Plus size={15} />}>
            Onboard a school
          </ButtonLink>
        }
      />
      <Card flush>
        <div className="platform-toolbar">
          <Tabs
            tabs={[
              { id: "", label: "All", count: counts ? counts.ACTIVE + counts.SUSPENDED : undefined },
              { id: "ACTIVE", label: "Active", count: counts?.ACTIVE },
              { id: "SUSPENDED", label: "Suspended", count: counts?.SUSPENDED }
            ]}
            value={params.status}
            onChange={status => setParams({ status })}
          />
          <div className="platform-filters">
            <SearchInput placeholder="Search by name or code" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search tenants" />
            <Select
              aria-label="Module"
              placeholder="Any module"
              options={addOns.map(m => ({ value: m.key, label: `Has ${m.label}` }))}
              value={params.module}
              onChange={e => setParams({ module: e.target.value })}
            />
            <Select aria-label="Sort" required options={SORTS} value={params.sort} onChange={e => setParams({ sort: e.target.value })} />
            {filtered && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={schools.data?.rows}
          rowKey={s => s.id}
          loading={schools.isPending}
          error={schools.error}
          onRetry={() => void schools.refetch()}
          onRowClick={s => navigate(`/adminConsole/tenants/${s.id}`)}
          meta={schools.data?.meta}
          onPageChange={setPage}
          empty={
            filtered ? (
              <EmptyState title="No tenants match" message="Try another name or code, or clear the filters." actions={<Button onClick={clear}>Clear filters</Button>} />
            ) : (
              <EmptyState
                icon={<Building2 />}
                title="No tenants yet"
                message="Onboard the first school: its details, number of students, administrator and modules."
                actions={
                  <ButtonLink to="/adminConsole/tenants/new" variant="primary" icon={<Plus size={15} />}>
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
