import { useMemo, useState } from "react";
import { Button, DataTable, EmptyState, ErrorState, PersonCell, SearchInput, SkeletonBlock } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { matchesSearch } from "@/modules/users/shared";
import { useAllParents, type Parent } from "../api/parents";

const SHOWN = 8;

/* Pick an existing parent by name, email, phone or code. The API has no parent search,
   so up to 500 parents are loaded once and filtered here. */
export function ParentPicker({
  value,
  onChange,
  exclude = []
}: {
  /* Only what the chosen card shows, so a parent taken from a sibling's links fits too */
  value: Pick<Parent, "id" | "parentCode" | "user"> | null;
  onChange: (parent: Parent | null) => void;
  /* Parent ids that can't be picked (already linked or already on the form) */
  exclude?: string[];
}) {
  const [search, setSearch] = useState("");
  const all = useAllParents(!value);

  const matches = useMemo(() => {
    const rows = (all.data?.rows ?? []).filter(p => !exclude.includes(p.id));
    return search.trim()
      ? rows.filter(p => matchesSearch(search, p.user.firstName, p.user.lastName, p.user.email, p.user.phone, p.parentCode))
      : rows;
  }, [all.data, search, exclude]);

  if (value)
    return (
      <div className="row-between" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
        <PersonCell name={fullName(value.user)} sub={[value.parentCode, value.user.email, value.user.phone].filter(Boolean).join(" · ")} />
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );

  if (all.isLoading) return <SkeletonBlock lines={3} />;
  if (all.error) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />;

  const total = all.data?.total ?? 0;
  const loaded = all.data?.rows.length ?? 0;
  return (
    <div className="stack-sm">
      <SearchInput autoFocus placeholder="Search by name, email, phone or parent code" value={search} onChange={e => setSearch(e.target.value)} />
      <DataTable
        rows={matches.slice(0, SHOWN)}
        rowKey={p => p.id}
        onRowClick={p => onChange(p)}
        columns={[
          { key: "name", header: "Parent", render: p => <PersonCell name={fullName(p.user)} sub={p.user.email} /> },
          { key: "phone", header: "Phone", render: p => p.user.phone ?? <span className="muted">—</span> },
          { key: "parentCode", header: "Code", render: p => <span className="mono">{p.parentCode}</span> }
        ]}
        empty={<EmptyState title={search ? "No parent matches this search" : "No parents yet"} />}
      />
      <div className="small muted">
        {matches.length > SHOWN && `Showing ${SHOWN} of ${matches.length} matches. Type more to narrow it down. `}
        {total > loaded && `Only the newest ${loaded} of ${total} parents can be searched here.`}
      </div>
    </div>
  );
}
