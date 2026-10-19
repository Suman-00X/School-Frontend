import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useDebounce, useListParams } from "@/common/hooks";
import { Badge, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, SearchInput, Select, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useManagedModules, useOperatorRoles, type OperatorRole } from "../api/access";

/* AD-04 */
export default function OperatorRolesListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { modules } = useManagedModules();
  const canManage = can("administration.access.manage") && modules.length > 0;
  const { params, setParam, setPage } = useListParams({ module: "", search: "" });
  const [searchText, setSearchText] = useState(params.search);
  const search = useDebounce(searchText, 300);
  useEffect(() => {
    if (search !== params.search) setParam("search", search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const list = useOperatorRoles(params);

  const columns: Column<OperatorRole>[] = [
    {
      key: "name",
      header: "Name",
      render: r => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 550 }}>{r.name}</div>
          {r.description && <div className="small muted">{r.description}</div>}
        </div>
      )
    },
    { key: "module", header: "Module", render: r => <Badge>{r.moduleLabel}</Badge> },
    { key: "permissions", header: "Permissions", align: "right", render: r => r.permissions.length },
    {
      key: "holders",
      header: "Holders",
      align: "right",
      render: r =>
        r.holders ? (
          <Link to={`/administration/access/assignments?operatorRoleId=${r.id}&module=${r.module}`} onClick={e => e.stopPropagation()}>
            {r.holders}
          </Link>
        ) : (
          <span className="muted">0</span>
        )
    },
    { key: "updatedAt", header: "Updated", render: r => <span className="nowrap">{formatDate(r.updatedAt)}</span> }
  ];

  return (
    <Page>
      <PageHeader
        title="Operator roles"
        subtitle="Named sets of permissions you give staff in the add-on modules"
        actions={
          canManage && (
            <ButtonLink
              variant="primary"
              icon={<Plus />}
              to={`/administration/access/operator-roles/new${params.module ? `?module=${params.module}` : ""}`}
            >
              New role
            </ButtonLink>
          )
        }
      />
      <Card flush>
        <div className="filter-bar">
          {modules.length > 1 && (
            <Select
              label="Module"
              className="select-sm"
              value={params.module}
              onChange={e => setParam("module", e.target.value)}
              placeholder="All my modules"
              options={modules}
            />
          )}
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <span className="field-label">Search</span>
            <SearchInput placeholder="Role name" value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => navigate(`/administration/access/operator-roles/${r.id}`)}
          empty={
            <EmptyState
              icon={<KeyRound />}
              title={params.search || params.module ? "No operator roles match." : "No operator roles yet"}
              message={
                params.search || params.module
                  ? undefined
                  : "A role bundles permissions of one module, for example a library desk role that issues and returns books."
              }
            />
          }
        />
      </Card>
    </Page>
  );
}
