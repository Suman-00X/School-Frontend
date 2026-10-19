import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListPlus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList } from "@/common/hooks";
import { Badge, Button, Card, EmptyState, ErrorState, Page, PageHeader, Skeleton, SkeletonBlock } from "@/common/ui";
import { byClassOrder, CLASSES_PATH, useClassLevels, type SchoolClass } from "../api/classes";
import { BulkClassesDialog } from "../components/BulkClassesDialog";
import { RollNumberRuleCard } from "../components/RollNumberRuleCard";
import { RollNumbersDialog } from "../components/RollNumbersDialog";
import { ClassDrawer } from "../components/ClassDrawer";
import { SectionsPanel } from "../components/SectionsPanel";
import "../components/classes.css";

/* AC-02: classes (school-wide levels) on the left, the selected class's sections for the header's
   year on the right. While loading, both columns show placeholders of their final shape. */
export default function ClassesPage() {
  const { can } = useAuth();
  const { selected: year } = useAcademicYear();
  const [search, setSearch] = useSearchParams();
  /* At most 15 levels, so one page holds every class (plus any from before levels) */
  const list = useApiList<SchoolClass>(CLASSES_PATH, { limit: 100 });
  const canCreate = can("academics.classes.create");
  const canUpdate = can("academics.classes.update");
  const levels = useClassLevels();
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rollAll, setRollAll] = useState(false);
  /* The roll-number rule sits under the class list, in loading and loaded states alike */
  const ruleCard = can("academics.enrollments.readPolicy") && <RollNumberRuleCard onAssignAll={() => setRollAll(true)} />;

  const classes = [...(list.rows ?? [])].sort(byClassOrder);
  const selected = classes.find(c => c.id === search.get("class")) ?? classes[0] ?? null;
  const select = (id: string) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        next.set("class", id);
        return next;
      },
      { replace: true }
    );

  const allCreated = !!levels.data && levels.data.every(l => l.created);
  const createTitle = allCreated ? "Every level already has a class" : undefined;

  /* One way in: tick one level or several */
  const actions = canCreate && (
    <Button variant="primary" icon={<ListPlus />} onClick={() => setBulkOpen(true)} disabled={allCreated} title={createTitle}>
      Add classes
    </Button>
  );

  let body;
  if (list.error) body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  else if (list.isLoading)
    body = (
      <div className="master-detail" aria-busy="true">
        <div className="stack">
          <Card flush title="Classes">
            <ul className="class-list">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="class-item is-placeholder">
                  <Skeleton width="60%" />
                </li>
              ))}
            </ul>
          </Card>
          {ruleCard}
        </div>
        <Card title="Sections" subtitle={<Skeleton width={220} height={12} />}>
          <SkeletonBlock lines={5} />
        </Card>
      </div>
    );
  else if (!selected)
    body = (
      <Card>
        <EmptyState
          title="No classes yet"
          message="Add the levels your school teaches (Nursery … Class 12), then the sections of each for this year."
          actions={
            canCreate && (
              <Button variant="primary" icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
                Add classes
              </Button>
            )
          }
        />
      </Card>
    );
  else
    body = (
      <div className="master-detail">
        <div className="stack">
          <Card flush title={`Classes (${classes.length})`}>
            <ul className="class-list" aria-label="Classes">
              {classes.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`class-item${c.id === selected.id ? " active" : ""}`}
                    aria-current={c.id === selected.id || undefined}
                    onClick={() => select(c.id)}
                  >
                    <span className="class-name">{c.className}</span>
                    {!c.level && <Badge tone="warning">Set level</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {ruleCard}
        </div>
        <SectionsPanel
          key={selected.id}
          klass={selected}
          classes={classes}
          onSetLevel={canUpdate ? () => setEditing(selected) : undefined}
        />
      </div>
    );

  return (
    <Page>
      {/* A section of Academics › Setup: the side list sits on the left */}
      <PageHeader
        title="Classes & sections"
        subtitle={`Classes are school-wide levels, Nursery to Class 12. Sections belong to ${year?.yearName ?? "the year chosen in the header"}.`}
        actions={actions}
      />
      {body}
      {editing && <ClassDrawer open klass={editing} levels={levels.data} onClose={() => setEditing(null)} onSaved={c => select(c.id)} />}
      {rollAll && (
        <RollNumbersDialog target={{ all: true }} label={`all of ${year?.yearName ?? "the year"}`} onClose={() => setRollAll(false)} />
      )}
      {bulkOpen && <BulkClassesDialog open onClose={() => setBulkOpen(false)} levels={levels.data} />}
    </Page>
  );
}
