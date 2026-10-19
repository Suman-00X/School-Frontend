import { useState } from "react";
import { Link } from "react-router-dom";
import { ListPlus, Pencil, Plus } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList } from "@/common/hooks";
import { Alert, Button, Card, DataTable, EmptyState } from "@/common/ui";
import type { SchoolClass } from "../api/classes";
import { SECTIONS_PATH, useTeacherOptions, type Section } from "../api/sections";
import { BulkSectionsDialog } from "./BulkSectionsDialog";
import { SectionDrawer } from "./SectionDrawer";

const dash = <span className="muted">—</span>;

/* The selected class's sections in the header's academic year */
export function SectionsPanel({ klass, classes, onEditClass }: { klass: SchoolClass; classes: SchoolClass[]; onEditClass?: () => void }) {
  const { can } = useAuth();
  const { selected, readOnly } = useAcademicYear();
  const teachers = useTeacherOptions();
  const list = useApiList<Section>(SECTIONS_PATH, { classId: klass.id, limit: 100 });
  const [drawer, setDrawer] = useState<{ section: Section | null } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const yearName = selected?.yearName ?? "the current year";
  const subtitle = [
    !klass.level && "Level not set",
    `Sections in ${yearName}${readOnly ? " (archived, read-only)" : ""}`,
    klass.description
  ]
    .filter(Boolean)
    .join(" · ");
  const canCreate = can("academics.sections.create") && !readOnly;
  const canUpdate = can("academics.sections.update") && !readOnly;
  const noYear = isApiError(list.error) && list.error.status === 422;

  return (
    <Card
      flush
      title={klass.className}
      subtitle={subtitle}
      actions={
        <>
          {onEditClass &&
            (klass.level ? (
              <Button size="sm" variant="ghost" icon={<Pencil />} onClick={onEditClass}>
                Edit class
              </Button>
            ) : (
              <Button size="sm" icon={<Pencil />} onClick={onEditClass}>
                Set level
              </Button>
            ))}
          {canCreate && !noYear && (
            <>
              <Button size="sm" icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
                Add sections
              </Button>
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setDrawer({ section: null })}>
                New section
              </Button>
            </>
          )}
        </>
      }
    >
      {noYear ? (
        <div style={{ padding: 16 }}>
          <Alert
            tone="warning"
            title="No academic year to show sections for"
            action={can("academics.academicYears.read") ? <Link to="/academics/academic-years">Academic years</Link> : undefined}
          >
            {list.error instanceof Error ? list.error.message : null}
          </Alert>
        </div>
      ) : (
        <DataTable
          rows={list.rows}
          rowKey={s => s.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          onRowClick={s => setDrawer({ section: s })}
          empty={
            <EmptyState
              title={`No sections in ${yearName}`}
              message={canCreate ? "Add the sections (A, B, C…) this class has this year." : undefined}
              actions={
                canCreate && (
                  <Button variant="primary" icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
                    Add sections
                  </Button>
                )
              }
            />
          }
          columns={[
            { key: "sectionName", header: "Section", render: s => <strong>{s.sectionName}</strong> },
            { key: "classTeacher", header: "Class teacher", render: s => teachers.label(s.classTeacher) ?? dash },
            { key: "deputy", header: "Deputy", render: s => teachers.label(s.deputyClassTeacher) ?? dash },
            { key: "capacity", header: "Capacity", align: "right", render: s => s.capacity ?? dash }
          ]}
        />
      )}

      <SectionDrawer
        open={!!drawer}
        section={drawer?.section ?? null}
        classes={classes}
        defaultClassId={klass.id}
        yearName={yearName}
        canEdit={drawer?.section ? canUpdate : canCreate}
        onClose={() => setDrawer(null)}
      />
      {bulkOpen && (
        <BulkSectionsDialog
          open
          onClose={() => setBulkOpen(false)}
          klass={klass}
          existing={(list.rows ?? []).map(s => s.sectionName)}
          yearName={yearName}
        />
      )}
    </Card>
  );
}
