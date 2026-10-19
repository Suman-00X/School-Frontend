import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, PersonCell, type Column } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { useParents, type Parent } from "../api/parents";
import { ParentDrawer } from "../components/ParentDrawer";

/* PE-04: parents list; ?parent=<id> opens the drawer (linked from the student profile) */
export default function ParentsListPage() {
  const { can } = useAuth();
  const { params, setPage } = useListParams({});
  const [search, setSearch] = useSearchParams();
  const openId = search.get("parent");
  const list = useParents({ page: params.page, limit: params.limit });

  /* Selection is by account (what invitations take); names label the skipped dialog across pages */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const select = (next: Set<string>) => {
    setSelected(next);
    setNames(n => ({ ...n, ...Object.fromEntries((list.rows ?? []).map(r => [r.userId, fullName(r.user)])) }));
  };

  const open = (id: string | null) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        if (id) next.set("parent", id);
        else next.delete("parent");
        return next;
      },
      { replace: true }
    );

  const columns: Column<Parent>[] = [
    { key: "parentCode", header: "Parent code", width: 140, render: p => <span className="mono">{p.parentCode}</span> },
    { key: "name", header: "Name", render: p => <PersonCell name={fullName(p.user)} /> },
    { key: "phone", header: "Phone", render: p => p.user.phone ?? <span className="muted">—</span> },
    { key: "email", header: "Email", render: p => p.user.email },
    { key: "occupation", header: "Occupation", render: p => p.occupation || <span className="muted">—</span> }
  ];

  return (
    <Page>
      <PageHeader
        title="Parents"
        subtitle="Parents and guardians. Link them to a student from the student's profile."
        actions={
          can("users.parents.create") && (
            <ButtonLink to="/users/parents/new" variant="primary" icon={<Plus />}>
              New parent
            </ButtonLink>
          )
        }
      />
      <Card flush>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={p => p.userId}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={p => open(p.id)}
          selection={can("auth.credentials.invite") ? { selected, onChange: select } : undefined}
          bulkActions={<InviteButton size="sm" userIds={[...selected]} names={names} onDone={() => setSelected(new Set())} />}
          empty={
            <EmptyState
              icon={<UsersRound />}
              title="No parents yet"
              message="Parents are added during admission, from a student's profile, or here."
              actions={
                can("users.parents.create") && (
                  <ButtonLink to="/users/parents/new" icon={<Plus />}>
                    New parent
                  </ButtonLink>
                )
              }
            />
          }
        />
      </Card>
      <ParentDrawer parentId={openId} onClose={() => open(null)} />
    </Page>
  );
}
