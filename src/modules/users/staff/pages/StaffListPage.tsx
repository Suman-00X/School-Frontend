import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserCog } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, PersonCell, RoleBadge, Select, roleLabel, type Column } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { STAFF_ROLES, type StaffMember } from "../api/staff";

/* PE-06 · Staff: the school's non-teaching accounts */
export default function StaffListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParam, setPage } = useListParams({ role: "" });
  const list = useApiList<StaffMember>("/users/staff", params);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const canInvite = can("auth.credentials.invite");

  /* Selection is by account id: invitations go to accounts */
  const select = (next: Set<string>) => {
    setSelected(next);
    const picked = (list.rows ?? []).filter(s => next.has(s.user.id));
    setNames(n => ({ ...n, ...Object.fromEntries(picked.map(s => [s.user.id, fullName(s.user)])) }));
  };

  const columns: Column<StaffMember>[] = [
    { key: "employeeCode", header: "Code", width: 130, render: s => <span className="mono">{s.employeeCode}</span> },
    { key: "name", header: "Name", render: s => <PersonCell name={fullName(s.user)} /> },
    { key: "role", header: "Role", render: s => <RoleBadge role={s.user.role} /> },
    { key: "designation", header: "Designation", render: s => s.designation || <span className="muted">—</span> },
    { key: "department", header: "Department", render: s => s.department || <span className="muted">—</span> },
    { key: "phone", header: "Phone", render: s => s.user.phone ?? <span className="muted">—</span> },
    { key: "email", header: "Email", render: s => s.user.email }
  ];

  const newButton = can("users.staff.create") && (
    <ButtonLink variant="primary" icon={<Plus />} to="/users/staff/new">
      New staff member
    </ButtonLink>
  );

  return (
    <Page>
      <PageHeader title="Staff" subtitle="Administrators, office, accounts and the module owners." actions={newButton} />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Role"
            className="select-sm"
            value={params.role}
            onChange={e => setParam("role", e.target.value)}
            placeholder="All roles"
            options={STAFF_ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={s => s.user.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={s => navigate(`/users/staff/${s.id}`)}
          selection={canInvite ? { selected, onChange: select } : undefined}
          bulkActions={<InviteButton size="sm" variant="primary" userIds={[...selected]} names={names} onDone={() => setSelected(new Set())} />}
          empty={
            params.role ? (
              <EmptyState icon={<UserCog />} title={`No ${roleLabel(params.role).toLowerCase()} accounts`} />
            ) : (
              <EmptyState icon={<UserCog />} title="No staff members yet" actions={newButton} />
            )
          }
        />
      </Card>
    </Page>
  );
}
