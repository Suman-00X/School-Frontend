import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button, DataTable, EmptyState, ErrorState, PersonCell, SearchInput, SkeletonBlock } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { matchesSearch } from "@/modules/users/shared";
import { useAllParents, type Parent } from "../api/parents";

const SHOWN = 50;
/* The result box has one height whatever the search finds, so typing or picking never moves
   what comes after the picker (or resizes a centred dialog) */
const RESULTS_HEIGHT = 280;

/* Pick an existing parent by name, email, phone or code. The API has no parent search,
   so up to 500 parents are loaded once and filtered here. The chosen parent is named in a
   line above the search and ticked in the list; the picker keeps its shape either way. */
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
  const all = useAllParents();

  const matches = useMemo(() => {
    const rows = (all.data?.rows ?? []).filter(p => !exclude.includes(p.id));
    return search.trim()
      ? rows.filter(p => matchesSearch(search, p.user.firstName, p.user.lastName, p.user.email, p.user.phone, p.parentCode))
      : rows;
  }, [all.data, search, exclude]);

  const total = all.data?.total ?? 0;
  const loaded = all.data?.rows.length ?? 0;
  return (
    <div className="stack-sm">
      <div className="row-between" style={{ minHeight: 30, flexWrap: "nowrap" }}>
        <div className="small" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? (
            <>
              Chosen: <strong>{fullName(value.user)}</strong>{" "}
              <span className="muted">{[value.parentCode, value.user.email].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            <span className="muted">No parent chosen yet: pick one from the list.</span>
          )}
        </div>
        <Button size="sm" variant="ghost" style={{ visibility: value ? undefined : "hidden" }} onClick={() => onChange(null)}>
          Clear
        </Button>
      </div>
      <SearchInput autoFocus={!value} placeholder="Search by name, email, phone or parent code" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={{ height: RESULTS_HEIGHT, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        {all.isLoading ? (
          <div style={{ padding: 14 }}>
            <SkeletonBlock lines={4} />
          </div>
        ) : all.error ? (
          <ErrorState error={all.error} onRetry={() => void all.refetch()} />
        ) : (
          <DataTable
            rows={matches.slice(0, SHOWN)}
            rowKey={p => p.id}
            onRowClick={p => onChange(p)}
            columns={[
              {
                key: "chosen",
                header: "",
                width: 36,
                render: p => (p.id === value?.id ? <Check size={16} aria-label="Chosen" style={{ color: "var(--primary)" }} /> : null)
              },
              { key: "name", header: "Parent", render: p => <PersonCell name={fullName(p.user)} sub={p.user.email} /> },
              { key: "phone", header: "Phone", render: p => p.user.phone ?? <span className="muted">—</span> },
              { key: "parentCode", header: "Code", render: p => <span className="mono">{p.parentCode}</span> }
            ]}
            empty={<EmptyState title={search ? "No parent matches this search" : "No parents yet"} />}
          />
        )}
      </div>
      {/* A reserved line for the notes about what can be searched */}
      <div className="small muted" style={{ minHeight: 17 }}>
        {matches.length > SHOWN && `Showing ${SHOWN} of ${matches.length} matches. Type more to narrow it down. `}
        {total > loaded && `Only the newest ${loaded} of ${total} parents can be searched here.`}
      </div>
    </div>
  );
}
