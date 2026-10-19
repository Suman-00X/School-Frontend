import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, PersonCell, type Column } from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import type { Teacher } from "../api/teachers";

/* PE-05 · Teachers */
export default function TeachersListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setPage } = useListParams({});
  const list = useApiList<Teacher>("/users/teachers", params);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const canInvite = can("auth.credentials.invite");

  /* Selection is by account id: invitations go to accounts */
  const select = (next: Set<string>) => {
    setSelected(next);
    const picked = (list.rows ?? []).filter(t => next.has(t.user.id));
    setNames(n => ({ ...n, ...Object.fromEntries(picked.map(t => [t.user.id, fullName(t.user)])) }));
  };

  const columns: Column<Teacher>[] = [
    { key: "employeeCode", header: "Code", width: 140, render: t => <span className="mono">{t.employeeCode}</span> },
    { key: "name", header: "Name", render: t => <PersonCell name={fullName(t.user)} /> },
    { key: "phone", header: "Phone", render: t => t.user.phone ?? <span className="muted">—</span> },
    { key: "email", header: "Email", render: t => t.user.email },
    { key: "qualification", header: "Qualification", render: t => t.qualification || <span className="muted">—</span> },
    { key: "joiningDate", header: "Joined", render: t => (t.joiningDate ? formatDate(t.joiningDate) : <span className="muted">—</span>) },
    { key: "employmentType", header: "Type", render: t => (t.employmentType ? enumLabel(t.employmentType) : <span className="muted">—</span>) }
  ];

  const newButton = can("users.teachers.create") && (
    <ButtonLink variant="primary" icon={<Plus />} to="/users/teachers/new">
      New teacher
    </ButtonLink>
  );

  return (
    <Page>
      <PageHeader title="Teachers" subtitle="Teaching staff and their employment details." actions={newButton} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={t => t.user.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={t => navigate(`/users/teachers/${t.id}`)}
          selection={canInvite ? { selected, onChange: select } : undefined}
          bulkActions={<InviteButton size="sm" variant="primary" userIds={[...selected]} names={names} onDone={() => setSelected(new Set())} />}
          empty={<EmptyState icon={<Briefcase />} title="No teachers yet" actions={newButton} />}
        />
      </Card>
    </Page>
  );
}
