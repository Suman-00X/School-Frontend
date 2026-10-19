import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, CalendarClock, Crown, MoreHorizontal, Repeat, ShieldCheck, UserPlus, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  Menu,
  MenuItem,
  Page,
  PageHeader,
  PersonCell,
  RoleBadge,
  Select,
  StatusBadge,
  Tabs,
  useConfirm,
  useTabParam,
  useToast,
  type Column,
  type TabItem
} from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import {
  ASSIGNMENT_STATUSES,
  accessName,
  useAssignments,
  useManagedModules,
  useOperatorRoles,
  useRevokeAssignment,
  type Assignment,
  type AssignmentKind
} from "../api/access";
import { useEmployees } from "../api/people";
import { AssignmentFormDrawer } from "../components/AssignmentFormDrawer";
import { AssignmentDetailDrawer, EditDatesDrawer, isLive } from "../components/AssignmentDrawers";

const ANY = "ANY";

/* AD-05. Links from other pages: ?userId= / ?operatorRoleId= (also filters), &add=operator|owner
   opens the form prefilled, ?open=<assignmentId> opens one assignment. */
export default function AssignmentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useSearchParams();
  const canManage = can("administration.access.manage");
  const canOwners = can("administration.access.manageOwners");

  const tabs: TabItem[] = [
    { id: "operators", label: "Operators" },
    { id: "owners", label: "Owners", hidden: !canOwners }
  ];
  const [tab] = useTabParam(tabs);
  const kind: AssignmentKind = tab === "owners" ? "OWNER" : "OPERATOR";

  const { params, setParam, setParams, setPage } = useListParams({ module: "", status: "ACTIVE", operatorRoleId: "", userId: "" });
  const { modules } = useManagedModules();
  const { people, canList } = useEmployees();
  const roles = useOperatorRoles({ module: params.module, limit: 100 }, kind === "OPERATOR");

  const query = {
    kind,
    module: params.module,
    status: params.status === ANY ? undefined : params.status,
    operatorRoleId: kind === "OPERATOR" ? params.operatorRoleId : undefined,
    userId: params.userId,
    page: params.page,
    limit: params.limit
  };
  const list = useAssignments(query);
  /* The default view is the live ones: say how many start later */
  const scheduled = useAssignments({ ...query, status: "SCHEDULED", page: 1, limit: 1 }, params.status === "ACTIVE");
  const scheduledCount = scheduled.meta?.total ?? 0;

  const add = search.get("add");
  const formKind: AssignmentKind | null = add === "operator" && canManage ? "OPERATOR" : add === "owner" && canOwners ? "OWNER" : null;
  const openId = search.get("open");
  const [editing, setEditing] = useState<Assignment | null>(null);
  const revoke = useRevokeAssignment();

  const setQueryParam = (key: string, value: string | null) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const switchTab = (id: string) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        for (const k of ["tab", "operatorRoleId", "page", "open", "add"]) next.delete(k);
        if (id !== tabs[0].id) next.set("tab", id);
        return next;
      },
      { replace: true }
    );

  const canChange = (a: Assignment) => (a.kind === "OWNER" ? canOwners : canManage && can(`${a.module}.access.manage`));

  const onRevoke = async (a: Assignment) => {
    const ok = await confirm({
      title: `Revoke ${accessName(a)} from ${fullName(a.user)}?`,
      message: `${a.kind === "OWNER" ? `${fullName(a.user)} stops owning the ${a.moduleLabel} module.` : `${fullName(a.user)} loses this ${a.moduleLabel} role.`} Takes effect at once. The assignment stays in the history.`,
      confirmLabel: "Revoke"
    });
    if (!ok) return;
    revoke.mutate(a.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const personName = (id: string) =>
    people.find(p => p.id === id)?.name ?? (list.rows?.find(r => r.userId === id) ? fullName(list.rows.find(r => r.userId === id)!.user) : "this person");
  const roleName = (id: string) => roles.rows?.find(r => r.id === id)?.name ?? "this role";

  const columns: Column<Assignment>[] = [
    {
      key: "user",
      header: "Person",
      render: a => (
        <PersonCell
          name={fullName(a.user)}
          sub={a.user.email}
          extra={
            <>
              <RoleBadge role={a.user.role} />
              {a.user.status !== "ACTIVE" && <Badge tone="danger">{enumLabel(a.user.status)}</Badge>}
            </>
          }
        />
      )
    },
    ...(kind === "OPERATOR" ? [{ key: "role", header: "Role", render: (a: Assignment) => accessName(a) }] : []),
    { key: "module", header: "Module", render: a => <Badge>{a.moduleLabel}</Badge> },
    { key: "validFrom", header: "From", render: a => <span className="nowrap">{a.validFrom ? formatDate(a.validFrom) : <span className="muted">Start</span>}</span> },
    { key: "validTo", header: "Until", render: a => <span className="nowrap">{a.validTo ? formatDate(a.validTo) : <span className="muted">No end</span>}</span> },
    { key: "status", header: "Status", render: a => <StatusBadge status={a.status} /> },
    { key: "note", header: "Note", render: a => (a.note ? <span className="small">{a.note}</span> : <span className="muted">—</span>) },
    {
      key: "actions",
      header: "",
      width: 48,
      render: a =>
        isLive(a) && canChange(a) ? (
          <div onClick={e => e.stopPropagation()}>
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label="Actions" />}>
              {close => (
                <>
                  <MenuItem
                    icon={<CalendarClock />}
                    onClick={() => {
                      close();
                      setEditing(a);
                    }}
                  >
                    Edit dates
                  </MenuItem>
                  <MenuItem
                    icon={<Ban />}
                    danger
                    onClick={() => {
                      close();
                      void onRevoke(a);
                    }}
                  >
                    Revoke
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        ) : null
    }
  ];

  const statusOptions = useMemo(
    () => [...ASSIGNMENT_STATUSES.map(s => ({ value: s, label: enumLabel(s) })), { value: ANY, label: "Any status" }],
    []
  );
  const filtered = !!(params.module || params.operatorRoleId || params.userId || params.status !== "ACTIVE");

  return (
    <Page>
      <PageHeader
        title="Access assignments"
        subtitle="Who holds operator roles and who owns each add-on module"
        actions={
          <>
            {can("administration.access.handOver") && modules.length > 0 && (
              <ButtonLink icon={<Repeat />} to={`/administration/access/handovers/new${params.module ? `?module=${params.module}` : ""}`}>
                Hand over work
              </ButtonLink>
            )}
            {kind === "OWNER" && canOwners && (
              <Button variant="primary" icon={<Crown />} onClick={() => setQueryParam("add", "owner")}>
                Make owner
              </Button>
            )}
            {kind === "OPERATOR" && canManage && modules.length > 0 && (
              <Button variant="primary" icon={<UserPlus />} onClick={() => setQueryParam("add", "operator")}>
                Add operator
              </Button>
            )}
          </>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      <Card flush>
        <div className="filter-bar">
          {modules.length > 1 && (
            <Select
              label="Module"
              className="select-sm"
              value={params.module}
              onChange={e => setParams({ module: e.target.value, operatorRoleId: "" })}
              placeholder="All my modules"
              options={modules}
            />
          )}
          <Select label="Status" className="select-sm" value={params.status} onChange={e => setParam("status", e.target.value)} options={statusOptions} />
          {kind === "OPERATOR" && (
            <Select
              label="Role"
              className="select-sm"
              value={params.operatorRoleId}
              onChange={e => setParam("operatorRoleId", e.target.value)}
              placeholder="Any role"
              options={(roles.rows ?? []).map(r => ({ value: r.id, label: params.module ? r.name : `${r.name} (${r.moduleLabel})` }))}
            />
          )}
          {canList && (
            <Select
              label="Person"
              className="select-sm"
              value={params.userId}
              onChange={e => setParam("userId", e.target.value)}
              placeholder="Anyone"
              options={people.filter(p => p.role !== "ADMIN").map(p => ({ value: p.id, label: p.name }))}
            />
          )}
        </div>
        {(params.userId || params.operatorRoleId || (params.status === "ACTIVE" && scheduledCount > 0)) && (
          <div className="row" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
            {params.userId && !canList && <Chip label={`Person: ${personName(params.userId)}`} onClear={() => setParam("userId", "")} />}
            {params.operatorRoleId && kind === "OPERATOR" && !roles.rows?.some(r => r.id === params.operatorRoleId) && (
              <Chip label={`Role: ${roleName(params.operatorRoleId)}`} onClear={() => setParam("operatorRoleId", "")} />
            )}
            {params.status === "ACTIVE" && scheduledCount > 0 && (
              <Button size="sm" variant="link" onClick={() => setParam("status", "SCHEDULED")}>
                {scheduledCount} more start later
              </Button>
            )}
          </div>
        )}
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={a => setQueryParam("open", a.id)}
          empty={
            <EmptyState
              icon={<ShieldCheck />}
              title={filtered ? "No assignments match these filters." : kind === "OWNER" ? "No owners by assignment" : "No operators yet"}
              message={
                filtered
                  ? undefined
                  : kind === "OWNER"
                    ? "Each module's built-in manager already owns it. Make someone else an owner to share the job."
                    : "Give staff an operator role to let them work in a module."
              }
            />
          }
        />
      </Card>

      <AssignmentFormDrawer
        key={`${formKind}-${params.userId}-${params.operatorRoleId}`}
        kind={formKind ?? "OPERATOR"}
        open={!!formKind}
        onClose={() => setQueryParam("add", null)}
        prefill={{ module: params.module || undefined, operatorRoleId: params.operatorRoleId || undefined, userId: params.userId || undefined }}
      />
      <AssignmentDetailDrawer
        id={openId}
        onClose={() => setQueryParam("open", null)}
        canChange={canChange}
        onEdit={a => {
          setQueryParam("open", null);
          setEditing(a);
        }}
        onRevoke={a => void onRevoke(a)}
      />
      <EditDatesDrawer assignment={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="chip">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`}>
        <X />
      </button>
    </span>
  );
}
