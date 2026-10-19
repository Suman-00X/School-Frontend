import { useEffect, useMemo, useState } from "react";
import { History, UserRound, X } from "lucide-react";
import type { AuditEntry } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList, useDebounce, useListParams } from "@/common/hooks";
import {
  Button,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
  JsonView,
  MethodBadge,
  RoleBadge,
  SearchInput,
  Select,
  SkeletonBlock,
  TextInput,
  ErrorState,
  type Column
} from "@/common/ui";
import { formatDateTime, relativeTime } from "@/common/utils/format";

/* The shared activity log (MA-01). One component for:
   - the central audit log:   <ActivityLog basePath="/administration/audit-logs" showModuleFilter />
   - a module's activity tab: <ActivityLog basePath="/users/activity" module="users" />
   - a record's history:      <ActivityLog basePath="/users/activity" module="users" fixed={{ entityId }} compact />
   - a person's actions:      <ActivityLog basePath="/administration/audit-logs" fixed={{ userId }} compact />
   Filters live in the page URL (prefixed with `paramPrefix` when two logs could share a page). */

export const AUDIT_MODULES = [
  "auth",
  "users",
  "academics",
  "administration",
  "finance",
  "communication",
  "reports",
  "files",
  "library",
  "transport",
  "hostel",
  "hr",
  "inventory"
];

const METHODS = ["POST", "PUT", "PATCH", "DELETE"];

type CatalogueModule = {
  module: string;
  label: string;
  resources: { resource: string; label: string; permissions: { key: string; label: string }[] }[];
};

type Fixed = { userId?: string; entityId?: string };

/* Sign-in events have no catalogue label */
const EVENT_LABELS: Record<string, string> = { "auth.login": "Signed in", "auth.login.failed": "Failed sign-in" };
const actionLabel = (e: AuditEntry) => e.action ?? EVENT_LABELS[e.permission] ?? <span className="mono">{e.permission}</span>;

export function ActivityLog({
  basePath,
  module,
  showModuleFilter,
  fixed,
  compact,
  title
}: {
  basePath: string;
  /* The module the log is locked to (for the action filter's catalogue) */
  module?: string;
  showModuleFilter?: boolean;
  fixed?: Fixed;
  /* Hide the filter bar (record history, a person's actions) */
  compact?: boolean;
  title?: string;
}) {
  const { can } = useAuth();
  const { params, setParams, setParam, setPage } = useListParams({
    module: "",
    userId: "",
    permission: "",
    entityId: "",
    method: "",
    from: "",
    to: "",
    search: ""
  });
  const [searchText, setSearchText] = useState(params.search);
  const debouncedSearch = useDebounce(searchText, 350);
  useEffect(() => {
    if (!compact && debouncedSearch !== params.search) setParam("search", debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const [openId, setOpenId] = useState<string | null>(null);

  const query = compact
    ? { page: params.page, limit: params.limit, ...fixed }
    : {
        page: params.page,
        limit: params.limit,
        module: showModuleFilter ? params.module : undefined,
        userId: fixed?.userId ?? params.userId,
        permission: params.permission,
        entityId: fixed?.entityId ?? params.entityId,
        method: params.method,
        from: params.from,
        to: params.to,
        search: params.search
      };

  const list = useApiList<AuditEntry>(basePath, query);

  /* Action filter options from the permission catalogue (open to ADMIN and module owners) */
  const catalogueModule = showModuleFilter ? params.module : module;
  const catalogue = useApiGet<CatalogueModule[]>(
    !compact && catalogueModule && can("administration.access.read") ? "/administration/access/permissions" : null,
    { module: catalogueModule }
  );
  const actionOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const m of catalogue.data ?? [])
      for (const r of m.resources) {
        opts.push({ value: `${m.module}.${r.resource}.`, label: `${r.label} (all)` });
        for (const p of r.permissions) opts.push({ value: p.key, label: `  ${p.label}` });
      }
    return opts;
  }, [catalogue.data]);

  /* People filter: ADMIN can list accounts */
  const people = useApiList<{ id: string; firstName: string; lastName: string; role: string }>(
    "/users",
    { limit: 100 },
    { enabled: !compact && !fixed?.userId && can("users.accounts.read") }
  );

  const columns: Column<AuditEntry>[] = [
    {
      key: "createdAt",
      header: "When",
      width: 140,
      render: e => (
        <span title={formatDateTime(e.createdAt)} className="nowrap">
          {relativeTime(e.createdAt)}
        </span>
      )
    },
    {
      key: "actor",
      header: "Who",
      render: e => (
        <div className="row nowrap" style={{ gap: 6, flexWrap: "nowrap" }}>
          <span style={{ fontWeight: 550 }}>{e.actor?.name ?? <span className="muted">Someone</span>}</span>
          <RoleBadge role={e.actor?.role ?? e.role} />
        </div>
      )
    },
    ...(showModuleFilter ? [{ key: "module", header: "Module", render: (e: AuditEntry) => <span className="badge">{e.module}</span> }] : []),
    { key: "action", header: "Action", render: e => actionLabel(e) },
    { key: "summary", header: "What happened", render: e => e.summary ?? <span className="muted">—</span> },
    { key: "method", header: "", width: 90, render: e => <MethodBadge method={e.method} /> }
  ];

  const chip = (label: string, onClear: () => void) => (
    <span className="chip" key={label}>
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`}>
        <X />
      </button>
    </span>
  );

  const personName = (id: string) => {
    const p = people.rows?.find(u => u.id === id);
    return p ? `${p.firstName} ${p.lastName}` : list.rows?.find(e => e.userId === id)?.actor?.name ?? "this person";
  };

  return (
    <Card flush title={title}>
      {!compact && (
        <>
          <div className="filter-bar">
            {showModuleFilter && (
              <Select
                label="Module"
                className="select-sm"
                value={params.module}
                onChange={e => setParams({ module: e.target.value, permission: "" })}
                placeholder="All modules"
                options={AUDIT_MODULES.map(m => ({ value: m, label: m }))}
              />
            )}
            {!fixed?.userId && can("users.accounts.read") && (
              <Select
                label="Person"
                className="select-sm"
                value={params.userId}
                onChange={e => setParam("userId", e.target.value)}
                placeholder="Anyone"
                options={(people.rows ?? []).map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              />
            )}
            {actionOptions.length > 0 ? (
              <Select
                label="Action"
                className="select-sm"
                value={params.permission}
                onChange={e => setParam("permission", e.target.value)}
                placeholder="Any action"
                options={actionOptions}
              />
            ) : (
              <TextInput
                label="Permission"
                className="input-sm"
                placeholder="e.g. users. or users.accounts.update"
                value={params.permission}
                onChange={e => setParam("permission", e.target.value.trim())}
              />
            )}
            <Select
              label="Method"
              className="select-sm"
              value={params.method}
              onChange={e => setParam("method", e.target.value)}
              placeholder="Any"
              options={METHODS.map(m => ({ value: m, label: m }))}
            />
            <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
            <TextInput label="To" type="date" className="input-sm" value={params.to} onChange={e => setParam("to", e.target.value)} />
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <span className="field-label">Search</span>
              <SearchInput placeholder="Words in the summary" value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
          </div>
          {(params.userId || params.entityId) && (
            <div className="row" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
              {params.userId && !fixed?.userId && chip(`Person: ${personName(params.userId)}`, () => setParam("userId", ""))}
              {params.entityId && !fixed?.entityId && chip(`Record: ${params.entityId.slice(0, 8)}…`, () => setParam("entityId", ""))}
            </div>
          )}
        </>
      )}
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={e => e.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={e => setOpenId(e.id)}
        empty={<EmptyState icon={<History />} title="No activity matches these filters." />}
      />
      <EntryDrawer
        basePath={basePath}
        id={openId}
        onClose={() => setOpenId(null)}
        onFilter={compact ? undefined : f => {
          setOpenId(null);
          setParams(f);
        }}
      />
    </Card>
  );
}

function EntryDrawer({
  basePath,
  id,
  onClose,
  onFilter
}: {
  basePath: string;
  id: string | null;
  onClose: () => void;
  onFilter?: (f: Fixed) => void;
}) {
  const entry = useApiGet<AuditEntry>(id ? `${basePath}/${id}` : null);
  const e = entry.data;
  return (
    <Drawer open={!!id} onClose={onClose} title={e?.summary ?? e?.action ?? "Activity entry"} subtitle={e ? formatDateTime(e.createdAt) : undefined} wide>
      {entry.isLoading && <SkeletonBlock lines={8} />}
      {entry.error && <ErrorState error={entry.error} onRetry={() => void entry.refetch()} />}
      {e && (
        <div className="stack">
          <DescriptionList
            items={[
              { label: "Who", value: e.actor?.name ? <span className="row">{e.actor.name} <RoleBadge role={e.actor.role ?? e.role} /></span> : null },
              { label: "Module", value: e.module },
              { label: "Action", value: actionLabel(e) },
              { label: "Permission", value: <span className="mono">{e.permission}</span> },
              { label: "Record", value: e.entityId ? <span className="mono">{e.entityId}</span> : null, wide: true }
            ]}
          />
          {onFilter && (
            <div className="row">
              {e.entityId && (
                <Button size="sm" icon={<History />} onClick={() => onFilter({ entityId: e.entityId! })}>
                  History of this record
                </Button>
              )}
              {e.userId && (
                <Button size="sm" icon={<UserRound />} onClick={() => onFilter({ userId: e.userId! })}>
                  More by this person
                </Button>
              )}
            </div>
          )}
          <hr className="divider" />
          <div className="section-title">Request</div>
          <DescriptionList
            columns={2}
            items={[
              { label: "Method", value: <MethodBadge method={e.method} /> },
              { label: "Status", value: e.statusCode },
              { label: "Path", value: <span className="mono">{e.path}</span>, wide: true },
              { label: "IP address", value: e.ipAddress }
            ]}
          />
          <div className="section-title">Payload</div>
          <JsonView value={e.payload} />
        </div>
      )}
    </Drawer>
  );
}
