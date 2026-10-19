import { useState } from "react";
import { Link } from "react-router-dom";
import { ListOrdered, ListPlus, Pencil } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList } from "@/common/hooks";
import { Alert, Button, Card, DataTable, EmptyState } from "@/common/ui";
import type { SchoolClass } from "../api/classes";
import { SECTIONS_PATH, useTeacherOptions, type Section } from "../api/sections";
import type { RollTarget } from "../api/rollNumbers";
import { BulkSectionsDialog } from "./BulkSectionsDialog";
import { RollNumbersDialog } from "./RollNumbersDialog";
import { SectionDrawer } from "./SectionDrawer";

const dash = <span className="muted">—</span>;

/* The selected class's sections in the header's academic year */
export function SectionsPanel({ klass, classes, onSetLevel }: { klass: SchoolClass; classes: SchoolClass[]; onSetLevel?: () => void }) {
  const { can } = useAuth();
  const { selected, readOnly } = useAcademicYear();
  const teachers = useTeacherOptions();
  const list = useApiList<Section>(SECTIONS_PATH, { classId: klass.id, limit: 100 });
  const [open, setOpen] = useState<Section | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [roll, setRoll] = useState<{ target: RollTarget; label: string } | null>(null);

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
  /* Renumbering by the school's rule: never in an archived year */
  const canAssign = can("academics.enrollments.assignRollNumbers") && !readOnly && !noYear;
  const hasSections = (list.rows?.length ?? 0) > 0;

  return (
    <Card
      flush
      title={klass.className}
      subtitle={subtitle}
      actions={
        <>
          {/* Only a class from before levels needs this: a class's name comes from its level, so there is nothing else to edit */}
          {onSetLevel && !klass.level && (
            <Button size="sm" icon={<Pencil />} onClick={onSetLevel}>
              Set level
            </Button>
          )}
          {canAssign && (
            <Button
              size="sm"
              variant="ghost"
              icon={<ListOrdered />}
              disabled={!hasSections}
              title={hasSections ? `Renumber every section of ${klass.className} by the school's rule` : `${klass.className} has no sections in ${yearName}`}
              onClick={() => setRoll({ target: { classId: klass.id }, label: klass.className })}
            >
              Roll numbers
            </Button>
          )}
          {/* One way in: one name or several. Class teachers are set by opening a section. */}
          {canCreate && !noYear && (
            <Button size="sm" variant="primary" icon={<ListPlus />} onClick={() => setBulkOpen(true)}>
              Add sections
            </Button>
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
          onRowClick={setOpen}
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
            { key: "capacity", header: "Capacity", align: "right", render: s => s.capacity ?? dash },
            ...(canAssign
              ? [
                  {
                    key: "roll",
                    header: "",
                    align: "right" as const,
                    width: 48,
                    render: (s: Section) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<ListOrdered />}
                        aria-label={`Assign roll numbers in ${klass.className}-${s.sectionName}`}
                        title={`Assign roll numbers in ${klass.className}-${s.sectionName}`}
                        onClick={e => {
                          e.stopPropagation();
                          setRoll({ target: { sectionId: s.id }, label: `${klass.className}-${s.sectionName}` });
                        }}
                      />
                    )
                  }
                ]
              : [])
          ]}
        />
      )}

      {open && <SectionDrawer open section={open} classes={classes} yearName={yearName} canEdit={canUpdate} onClose={() => setOpen(null)} />}
      {roll && <RollNumbersDialog target={roll.target} label={roll.label} onClose={() => setRoll(null)} />}
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
