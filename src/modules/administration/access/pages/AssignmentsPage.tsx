import { useMemo, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Ban, CalendarClock, Crown, MoreHorizontal, ShieldCheck, UserPlus, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Menu,
  MenuItem,
  PageHeader,
  PersonCell,
  RoleBadge,
  Select,
  StatusBadge,
  useConfirm,
  useToast,
  type Column
} from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import {
  ASSIGNMENT_STATUSES,
  accessName,
  useAssignments,
  useManagedModules,
  useOperatorRole,
  useOperatorRoles,
  useRevokeAssignment,
  type Assignment,
  type AssignmentKind
} from "../api/access";
import { useEmployees } from "../api/people";
import { AssignmentFormDrawer } from "../components/AssignmentFormDrawer";
import { AssignmentDetailDrawer, EditDatesDrawer, isLive } from "../components/AssignmentDrawers";
import { OWNERS_PATH } from "../utils/paths";

const ANY = "ANY";

/* AD-05, two sections of the Access control area: Operators (/assignments) and Owners (/assignments/owners).
   Links from other pages: ?userId= / ?operatorRoleId= (also filters), &add=operator|owner opens the
   form prefilled, ?open=<assignmentId> opens one assignment. The old ?tab=owners still works. */
export default function AssignmentsPage({ kind }: { kind: AssignmentKind }) {
  const { can } = useAuth();
  const location = useLocation();
  const [search] = useSearchParams();
  const canOwners = can("administration.access.manageOwners");
  if (kind === "OPERATOR" && search.get("tab") === "owners" && canOwners) {
    const rest = new URLSearchParams(search);
    rest.delete("tab");
    const query = rest.toString();
    return <Navigate to={`${OWNERS_PATH}${query ? `?${query}` : ""}`} replace state={location.state} />;
  }
  return <Assignments kind={kind} />;
}

function Assignments({ kind }: { kind: AssignmentKind }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useSearchParams();
  const canManage = can("administration.access.manage");
  const canOwners = can("administration.access.manageOwners");

  const { params, setParam, setParams, setPage } = useListParams({ module: "", status: "ACTIVE", operatorRoleId: "", userId: "" });
  const { modules, isLoading: modulesLoading } = useManagedModules();
  const { people, canList } = useEmployees();
  const roles = useOperatorRoles({ module: params.module, limit: 100 }, kind === "OPERATOR");
  /* A role from a link that isn't in the list (yet): its name for the Role filter */
  const roleMissing = kind === "OPERATOR" && !!params.operatorRoleId && !!roles.rows && !roles.rows.some(r => r.id === params.operatorRoleId);
  const linkedRole = useOperatorRole(roleMissing ? params.operatorRoleId : null);

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
  const scheduledCount = params.status === "ACTIVE" ? (scheduled.meta?.total ?? 0) : 0;

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
  const roleOptions = (roles.rows ?? []).map(r => ({ value: r.id, label: params.module ? r.name : `${r.name} (${r.moduleLabel})` }));
  if (roleMissing) roleOptions.unshift({ value: params.operatorRoleId, label: linkedRole.data?.name ?? "This role" });

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

  const noModules = !modulesLoading && modules.length === 0;

  return (
    <div className="stack">
      <PageHeader
        title={kind === "OWNER" ? "Owners" : "Operators"}
        subtitle={
          kind === "OWNER"
            ? "Who runs each add-on module besides its built-in manager"
            : "Who holds an operator role in the add-on modules, and for how long"
        }
        actions={
          /* Shown from the start; disabled until the modules arrive, so the header never changes */
          kind === "OWNER"
            ? canOwners && (
                <Button variant="primary" icon={<Crown />} onClick={() => setQueryParam("add", "owner")} disabled={modulesLoading || noModules}>
                  Make owner
                </Button>
              )
            : canManage && (
                <Button variant="primary" icon={<UserPlus />} onClick={() => setQueryParam("add", "operator")} disabled={modulesLoading || noModules}>
                  Add operator
                </Button>
              )
        }
      />
      <Card flush>
        {/* One height: every filter is always a field in the bar, and the "start later" link has its place */}
        <div className="filter-bar">
          <Select
            label="Module"
            className="select-sm"
            value={params.module}
            onChange={e => setParams({ module: e.target.value, operatorRoleId: "" })}
            placeholder="All my modules"
            options={modules}
            disabled={modules.length < 2 && !params.module}
          />
          <Select label="Status" className="select-sm" value={params.status} onChange={e => setParam("status", e.target.value)} options={statusOptions} />
          {kind === "OPERATOR" && (
            <Select
              label="Role"
              className="select-sm"
              value={params.operatorRoleId}
              onChange={e => setParam("operatorRoleId", e.target.value)}
              placeholder="Any role"
              options={roleOptions}
            />
          )}
          {canList ? (
            <Select
              label="Person"
              className="select-sm"
              value={params.userId}
              onChange={e => setParam("userId", e.target.value)}
              placeholder="Anyone"
              options={people.filter(p => p.role !== "ADMIN").map(p => ({ value: p.id, label: p.name }))}
            />
          ) : (
            <ClearableField label="Person" value={params.userId ? personName(params.userId) : ""} placeholder="Anyone" onClear={() => setParam("userId", "")} />
          )}
          <div className="field" style={{ marginLeft: "auto", justifyContent: "flex-end", visibility: scheduledCount > 0 ? "visible" : "hidden" }}>
            <Button size="sm" variant="link" onClick={() => setParam("status", "SCHEDULED")} tabIndex={scheduledCount > 0 ? undefined : -1}>
              {scheduledCount || 0} more start later
            </Button>
          </div>
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
    </div>
  );
}

/* A filter that is always in the bar (applying it from a link never adds a row), with a clear button */
function ClearableField({ label, value, placeholder, onClear }: { label: string; value: string; placeholder: string; onClear: () => void }) {
  return (
    <div className="field" style={{ width: 190 }}>
      <span className="field-label">{label}</span>
      <div className="input-group">
        <input className="input input-sm" value={value} placeholder={placeholder} readOnly aria-label={label} title={value || undefined} />
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon input-addon"
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()}`}
          style={{ visibility: value ? "visible" : "hidden" }}
        >
          <X />
        </button>
      </div>
    </div>
  );
}
