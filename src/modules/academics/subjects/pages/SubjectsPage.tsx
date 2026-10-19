/* AC-03 · Subjects and section subjects (Academics › Setup) */
import { useState } from "react";
import { BookOpen, ListPlus, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, PageHeader, Tabs, useTabParam } from "@/common/ui";
import { SectionSelect } from "../../shared/components/SectionSelect";
import { SectionSubjectsPanel } from "../../section-subjects/components/SectionSubjectsPanel";
import { SUBJECTS_PATH, subjectTypeLabel, type Subject } from "../api/subjects";
import { BulkSubjectsDialog } from "../components/BulkSubjectsDialog";
import { SubjectDrawer } from "../components/SubjectDrawer";

/* Two tabs: the school-wide subject list, and the subjects of one section in the header's year */
export default function SubjectsPage() {
  const { can } = useAuth();
  const { selected: year } = useAcademicYear();
  const [tab, setTab] = useTabParam([
    { id: "subjects", label: "Subjects", hidden: !can("academics.subjects.read") },
    { id: "sections", label: "By section", hidden: !can("academics.sectionSubjects.read") }
  ]);
  const canCreate = can("academics.subjects.create");
  const [drawer, setDrawer] = useState<{ subject: Subject | null } | null>(null);
  const [bulk, setBulk] = useState(false);

  return (
    <Page>
      <PageHeader
        title="Subjects"
        subtitle={
          tab === "sections"
            ? `What each section is taught in ${year?.yearName ?? "the year chosen in the header"}`
            : "School-wide list of subjects; each section then picks the ones it is taught"
        }
        actions={
          tab === "subjects" &&
          canCreate && (
            <>
              <Button icon={<ListPlus />} onClick={() => setBulk(true)}>
                Add several
              </Button>
              <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ subject: null })}>
                New subject
              </Button>
            </>
          )
        }
      />
      <Tabs
        tabs={[
          { id: "subjects", label: "Subjects", hidden: !can("academics.subjects.read") },
          { id: "sections", label: "By section", hidden: !can("academics.sectionSubjects.read") }
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "subjects" ? <SubjectList onOpen={s => setDrawer({ subject: s })} onCreate={canCreate ? () => setDrawer({ subject: null }) : undefined} /> : <BySection />}
      <SubjectDrawer open={!!drawer} subject={drawer?.subject ?? null} canEdit={can("academics.subjects.update")} onClose={() => setDrawer(null)} />
      {bulk && <BulkSubjectsDialog onClose={() => setBulk(false)} />}
    </Page>
  );
}

function SubjectList({ onOpen, onCreate }: { onOpen: (s: Subject) => void; onCreate?: () => void }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<Subject>(SUBJECTS_PATH, { page: params.page, limit: params.limit });
  return (
    <Card flush>
      <DataTable
        rows={list.rows}
        rowKey={s => s.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={onOpen}
        empty={
          <EmptyState
            icon={<BookOpen />}
            title="No subjects yet"
            message="Add the subjects your school teaches, such as English, Mathematics and Science."
            actions={
              onCreate && (
                <Button variant="primary" icon={<Plus />} onClick={onCreate}>
                  New subject
                </Button>
              )
            }
          />
        }
        columns={[
          { key: "subjectCode", header: "Code", width: 120, render: s => <span className="mono">{s.subjectCode}</span> },
          {
            key: "subjectName",
            header: "Name",
            render: s => (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 550 }}>{s.subjectName}</div>
                {s.description && <div className="small muted">{s.description}</div>}
              </div>
            )
          },
          { key: "subjectType", header: "Type", render: s => subjectTypeLabel(s.subjectType) || <span className="muted">—</span> },
          { key: "isOptional", header: "Optional", render: s => (s.isOptional ? <Badge tone="info">Optional</Badge> : <span className="muted">No</span>) }
        ]}
      />
    </Card>
  );
}

function BySection() {
  const { params, setParam } = useListParams({ section: "" });
  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar">
          <SectionSelect value={params.section} onChange={e => setParam("section", e.target.value)} placeholder="Pick a section" />
        </div>
      </Card>
      {params.section ? (
        <SectionSubjectsPanel key={params.section} sectionId={params.section} />
      ) : (
        <Card>
          <EmptyState icon={<BookOpen />} title="Pick a section" message="Its subjects for the year, with how many classes a week each, appear here." />
        </Card>
      )}
    </div>
  );
}
