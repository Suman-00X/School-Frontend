import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { ROLES, type Account } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  Page,
  PageHeader,
  PersonCell,
  RoleBadge,
  Select,
  StatusBadge,
  roleLabel,
  type Column
} from "@/common/ui";
import { formatDateTime, fullName, relativeTime } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";

/* Deactivated accounts (INACTIVE) drop out of every list: the API doesn't list them yet (gap).
   The option says so, and so does the empty state; nothing is added under the filter. */
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive (not listed yet)" },
  { value: "BLOCKED", label: "Blocked" }
];

/* AD-06 · User accounts (the module's activity log is its own header tab) */
export default function AccountsListPage() {
  return (
    <Page>
      <PageHeader title="Accounts" subtitle="Every sign-in account in the school, whatever its role." />
      <AccountsTable />
    </Page>
  );
}

function AccountsTable() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParam, setPage } = useListParams({ role: "", status: "" });
  const list = useApiList<Account>("/users", params);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /* Names of everyone selected, across pages, for the "Not invited" table */
  const [names, setNames] = useState<Record<string, string>>({});
  const canInvite = can("auth.credentials.invite");
  const select = (next: Set<string>) => {
    setSelected(next);
    const picked = (list.rows ?? []).filter(a => next.has(a.id));
    setNames(n => ({ ...n, ...Object.fromEntries(picked.map(a => [a.id, fullName(a)])) }));
  };

  const columns: Column<Account>[] = [
    { key: "name", header: "Name", render: a => <PersonCell name={fullName(a)} sub={a.phone ?? undefined} /> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: a => <RoleBadge role={a.role} /> },
    { key: "status", header: "Status", render: a => <StatusBadge status={a.status} /> },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      render: a =>
        a.lastLoginAt ? (
          <span title={formatDateTime(a.lastLoginAt)} className="nowrap">
            {relativeTime(a.lastLoginAt)}
          </span>
        ) : (
          <span className="muted">Never</span>
        )
    },
    {
      key: "passwordChangedAt",
      header: "Password set",
      render: a => (a.passwordChangedAt ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>)
    }
  ];

  return (
    <Card flush>
      <div className="filter-bar">
        <Select
          label="Role"
          className="select-sm"
          value={params.role}
          onChange={e => setParam("role", e.target.value)}
          placeholder="All roles"
          options={ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
        />
        <Select
          label="Status"
          className="select-sm"
          value={params.status}
          onChange={e => setParam("status", e.target.value)}
          placeholder="Any status"
          options={STATUS_OPTIONS}
        />
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
        onRowClick={a => navigate(`/users/${a.id}`)}
        selection={canInvite ? { selected, onChange: select } : undefined}
        bulkActions={<InviteButton size="sm" variant="primary" userIds={[...selected]} names={names} onDone={() => setSelected(new Set())} />}
        empty={
          params.status === "INACTIVE" ? (
            <EmptyState
              icon={<Users />}
              title="Deactivated accounts are not listed yet"
              message="Deactivating an account removes it from the lists. Choose another status to see accounts."
            />
          ) : (
            <EmptyState icon={<Users />} title="No accounts match these filters." />
          )
        }
      />
    </Card>
  );
}
