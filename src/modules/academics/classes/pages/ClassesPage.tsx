import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListPlus, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { CLASSES_PATH, type SchoolClass } from "../api/classes";
import { BulkClassesDialog } from "../components/BulkClassesDialog";
import { ClassDrawer } from "../components/ClassDrawer";
import { SectionsPanel } from "../components/SectionsPanel";
import "../components/classes.css";

/* AC-02: classes (school-wide) on the left, the selected class's sections for the header's year on the right */
export default function ClassesPage() {
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  /* classOrder is 1–50, so one page holds every class */
  const list = useApiList<SchoolClass>(CLASSES_PATH, { limit: 100 });
  const [drawer, setDrawer] = useState<{ klass: SchoolClass | null } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const classes = list.rows ?? [];
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

  const canCreate = can("academics.classes.create");
  const canUpdate = can("academics.classes.update");
  const usedOrders = new Set(classes.map(c => c.classOrder));
  const nextOrder = classes.length ? Math.max(...classes.map(c => c.classOrder)) + 1 : 1;

  let body;
  if (list.error) body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  else if (list.isLoading)
    body = (
      <Card>
        <SkeletonBlock lines={6} />
      </Card>
    );
  else if (!selected)
    body = (
      <Card>
        <EmptyState
          title="No classes yet"
          message="Add the grade levels your school teaches, then the sections of each for this year."
          actions={
            canCreate && (
              <>
                <Button icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
                  Add many
                </Button>
                <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ klass: null })}>
                  New class
                </Button>
              </>
            )
          }
        />
      </Card>
    );
  else
    body = (
      <div className="master-detail">
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
                  <span className="class-order">{c.classOrder}</span>
                  {c.className}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <SectionsPanel
          key={selected.id}
          klass={selected}
          classes={classes}
          onEditClass={canUpdate ? () => setDrawer({ klass: selected }) : undefined}
        />
      </div>
    );

  return (
    <Page>
      <PageHeader
        title="Classes and sections"
        subtitle="Classes are school-wide. Sections belong to the academic year chosen in the header."
        breadcrumbs={[{ label: "Academics" }, { label: "Classes and sections" }]}
        actions={
          canCreate &&
          classes.length > 0 && (
            <>
              <Button icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
                Add many classes
              </Button>
              <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ klass: null })}>
                New class
              </Button>
            </>
          )
        }
      />
      {body}
      <ClassDrawer
        open={!!drawer}
        klass={drawer?.klass ?? null}
        nextOrder={nextOrder}
        onClose={() => setDrawer(null)}
        onSaved={c => select(c.id)}
      />
      {bulkOpen && <BulkClassesDialog open onClose={() => setBulkOpen(false)} usedOrders={usedOrders} />}
    </Page>
  );
}
