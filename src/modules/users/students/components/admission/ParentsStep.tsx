import { useMemo, useState } from "react";
import { ChevronDown, Copy, Link2, Plus, Trash2, UsersRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Alert, Button, Card, Checkbox, DataTable, Dialog, EmptyState, ErrorState, Menu, MenuItem, PersonCell, SearchInput, Select, SkeletonBlock, Switch } from "@/common/ui";
import { enumLabel, enumOptions, fullName } from "@/common/utils/format";
import { PARENT_RELATIONS, PersonFields, matchesSearch, useSchoolCurrency, type PersonValues } from "@/modules/users/shared";
import { ParentPicker, ParentProfileFields, type ParentProfileValues } from "@/modules/users/parents";
import { useAllStudents, useStudentParents, type Student } from "../../api/students";
import { MAX_PARENTS, cardName, newCard, type ParentCard, type PickedParent } from "./state";

const relationOptions = enumOptions(PARENT_RELATIONS);

export function ParentsStep({ cards, onChange }: { cards: ParentCard[]; onChange: (cards: ParentCard[]) => void }) {
  const { can } = useAuth();
  const [sibling, setSibling] = useState(false);
  const full = cards.length >= MAX_PARENTS;
  const primaries = cards.filter(c => c.isPrimaryContact).length;

  const update = (key: string, fn: (c: ParentCard) => ParentCard) => onChange(cards.map(c => (c.key === key ? fn(c) : c)));
  const add = (card: ParentCard) => onChange([...cards, { ...card, isPrimaryContact: cards.length === 0 }]);
  /* Primary contact: switching one on switches the others off (one is suggested, not required) */
  const setPrimary = (key: string, on: boolean) => onChange(cards.map(c => ({ ...c, isPrimaryContact: c.key === key ? on : on ? false : c.isPrimaryContact })));

  const canExisting = can("users.parents.read");
  const canSibling = can("users.students.readParents");

  return (
    <div className="stack">
      <div className="row-between">
        <div className="small muted">Up to {MAX_PARENTS} parents or guardians. You can skip this step and link parents later from the profile.</div>
        <Menu
          trigger={(toggle, open) => (
            <Button icon={<Plus />} disabled={full} onClick={toggle} aria-expanded={open} aria-haspopup="menu">
              Add parent <ChevronDown size={14} />
            </Button>
          )}
        >
          {close => (
            <>
              <MenuItem
                icon={<Plus />}
                onClick={() => {
                  close();
                  add(newCard("new"));
                }}
              >
                New parent
              </MenuItem>
              {canExisting && (
                <MenuItem
                  icon={<Link2 />}
                  onClick={() => {
                    close();
                    add(newCard("existing"));
                  }}
                >
                  Existing parent
                </MenuItem>
              )}
              {canSibling && (
                <MenuItem
                  icon={<Copy />}
                  onClick={() => {
                    close();
                    setSibling(true);
                  }}
                >
                  Copy from a sibling
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      </div>

      {cards.length > 0 && primaries !== 1 && (
        <Alert tone="warning">{primaries === 0 ? "No primary contact is set. Pick one so the school knows whom to call first." : "More than one primary contact is set."}</Alert>
      )}

      {cards.length === 0 && <EmptyState icon={<UsersRound />} title="No parents added" message="Add a new parent, pick an existing one, or copy a sibling's parents." />}

      {cards.map((c, i) => (
        <ParentCardView
          key={c.key}
          index={i}
          card={c}
          onChange={fn => update(c.key, fn)}
          onPrimary={on => setPrimary(c.key, on)}
          onRemove={() => onChange(cards.filter(x => x.key !== c.key))}
          exclude={cards.filter(x => x.key !== c.key && x.parent).map(x => x.parent!.id)}
        />
      ))}

      {sibling && (
        <SiblingDialog
          room={MAX_PARENTS - cards.length}
          takenIds={cards.filter(c => c.parent).map(c => c.parent!.id)}
          onClose={() => setSibling(false)}
          onPick={picked => {
            const hasPrimary = cards.some(c => c.isPrimaryContact);
            onChange([
              ...cards,
              ...picked.map(p => newCard("existing", { parent: p.parent, relation: p.relation, isPrimaryContact: !hasPrimary && p.isPrimaryContact }))
            ]);
            setSibling(false);
          }}
        />
      )}
    </div>
  );
}

function ParentCardView({
  index,
  card: c,
  onChange,
  onPrimary,
  onRemove,
  exclude
}: {
  index: number;
  card: ParentCard;
  onChange: (fn: (c: ParentCard) => ParentCard) => void;
  onPrimary: (on: boolean) => void;
  onRemove: () => void;
  exclude: string[];
}) {
  const currency = useSchoolCurrency();
  const clear = (errors: Record<string, string>, key: string) => {
    if (!errors[key]) return errors;
    const next = { ...errors };
    delete next[key];
    return next;
  };
  const personBind = {
    values: c.person,
    errors: c.errors,
    set: <K extends keyof PersonValues>(key: K, value: PersonValues[K]) =>
      onChange(x => ({ ...x, person: { ...x.person, [key]: value }, errors: clear(x.errors, key) }))
  };
  const profileBind = {
    values: c.profile,
    errors: c.errors,
    set: (key: keyof ParentProfileValues, value: string) => onChange(x => ({ ...x, profile: { ...x.profile, [key]: value }, errors: clear(x.errors, key) }))
  };

  return (
    <Card
      title={`${index + 1}. ${cardName(c)}`}
      subtitle={c.mode === "existing" ? "Existing parent" : "New parent account"}
      actions={<Button size="sm" variant="ghost" icon={<Trash2 />} onClick={onRemove} aria-label={`Remove ${cardName(c)}`} />}
    >
      <div className="stack">
        {c.error && <Alert tone="danger">{c.error}</Alert>}
        {c.mode === "existing" ? (
          <ParentPicker
            value={c.parent}
            exclude={exclude}
            onChange={p => onChange(x => ({ ...x, parent: p ? { id: p.id, parentCode: p.parentCode, user: p.user } : null, error: undefined }))}
          />
        ) : (
          <>
            <PersonFields form={personBind} emailHint="The parent signs in with this email" />
            <ParentProfileFields form={profileBind} currency={currency} />
          </>
        )}
        <div className="form-grid">
          <Select
            label="Relation"
            required
            placeholder="Choose"
            options={relationOptions}
            value={c.relation}
            error={c.errors.relation}
            onChange={e => {
              const relation = e.target.value;
              onChange(x => ({ ...x, relation, errors: clear(x.errors, "relation") }));
            }}
          />
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <Switch label="Primary contact" checked={c.isPrimaryContact} onChange={onPrimary} />
          </div>
        </div>
      </div>
    </Card>
  );
}

type SiblingPick = { parent: PickedParent; relation: string; isPrimaryContact: boolean };

/* Pick the sibling (the API has no student search: up to 500 loaded and filtered here), then tick their parents */
function SiblingDialog({
  room,
  takenIds,
  onClose,
  onPick
}: {
  room: number;
  takenIds: string[];
  onClose: () => void;
  onPick: (picked: SiblingPick[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [sibling, setSibling] = useState<Student | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const students = useAllStudents(!sibling);
  const links = useStudentParents(sibling?.id, !!sibling);

  const matches = useMemo(() => {
    const rows = students.data?.rows ?? [];
    return search.trim() ? rows.filter(s => matchesSearch(search, s.user.firstName, s.user.lastName, s.studentCode, s.admissionNumber, s.user.email)) : rows;
  }, [students.data, search]);

  const available = (links.rows ?? []).filter(l => !takenIds.includes(l.parentId));
  const tooMany = ticked.size > room;

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="Copy parents from a sibling"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {sibling && (
            <Button
              variant="primary"
              disabled={!ticked.size || tooMany}
              onClick={() =>
                onPick(
                  available
                    .filter(l => ticked.has(l.parentId))
                    .map(l => ({ parent: { id: l.parent.id, parentCode: l.parent.parentCode, user: l.parent.user }, relation: l.relation, isPrimaryContact: l.isPrimaryContact }))
                )
              }
            >
              Add {ticked.size || ""} parent{ticked.size === 1 ? "" : "s"}
            </Button>
          )}
        </>
      }
    >
      {!sibling ? (
        <div className="stack-sm">
          <SearchInput autoFocus placeholder="Search the sibling by name, student code or admission number" value={search} onChange={e => setSearch(e.target.value)} />
          {students.isLoading ? (
            <SkeletonBlock lines={4} />
          ) : students.error ? (
            <ErrorState error={students.error} onRetry={() => void students.refetch()} />
          ) : (
            <DataTable
              rows={matches.slice(0, 8)}
              rowKey={s => s.id}
              onRowClick={s => {
                setSibling(s);
                setTicked(new Set());
              }}
              columns={[
                { key: "name", header: "Student", render: s => <PersonCell name={fullName(s.user)} sub={s.user.email} /> },
                { key: "code", header: "Code", render: s => <span className="mono">{s.studentCode}</span> },
                { key: "admissionNumber", header: "Admission no." }
              ]}
              empty={<EmptyState title="No student matches this search" />}
            />
          )}
          {(students.data?.total ?? 0) > (students.data?.rows.length ?? 0) && (
            <div className="small muted">Only the newest {students.data!.rows.length} of {students.data!.total} students can be searched here.</div>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="row-between">
            <PersonCell name={fullName(sibling.user)} sub={sibling.studentCode} />
            <Button size="sm" variant="ghost" onClick={() => setSibling(null)}>
              Change
            </Button>
          </div>
          {links.isLoading && <SkeletonBlock lines={3} />}
          {links.error && <ErrorState error={links.error} onRetry={() => void links.refetch()} />}
          {links.rows && available.length === 0 && (
            <EmptyState title={links.rows.length ? "These parents are already on the form" : "This student has no linked parents"} />
          )}
          {available.map(l => (
            <Checkbox
              key={l.parentId}
              checked={ticked.has(l.parentId)}
              onChange={() =>
                setTicked(t => {
                  const next = new Set(t);
                  if (next.has(l.parentId)) next.delete(l.parentId);
                  else next.add(l.parentId);
                  return next;
                })
              }
              label={
                <span>
                  <strong>{fullName(l.parent.user)}</strong> · {enumLabel(l.relation)}
                  {l.isPrimaryContact && " · primary contact"} <span className="muted">({l.parent.user.email})</span>
                </span>
              }
            />
          ))}
          {tooMany && <Alert tone="warning">Only {room} more parent{room === 1 ? "" : "s"} can be added.</Alert>}
        </div>
      )}
    </Dialog>
  );
}
