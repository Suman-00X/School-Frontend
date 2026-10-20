/* AC-03 · Subjects (Academics › Setup › School structure): the subjects the school teaches,
   shared by every year. Sections are given theirs under Setup › Curriculum. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Badge, Button, Card, DataTable, EmptyState, Field, Page, PageHeader, SearchInput } from "@/common/ui";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { subjectTypeLabel, useSubjectOptions, type Subject } from "../api/subjects";
import { SubjectDrawer } from "../components/SubjectDrawer";

export default function SubjectsPage() {
  const { can } = useAuth();
  const list = useSubjectOptions();
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{ subject: Subject | null } | null>(null);
  const canCreate = can("academics.subjects.create");
  const canEdit = can("academics.subjects.update");

  const q = search.trim().toLowerCase();
  const rows = q ? list.subjects.filter(s => s.subjectName.toLowerCase().includes(q) || s.subjectCode.toLowerCase().includes(q)) : list.subjects;

  const addButton = canCreate && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ subject: null })}>
      Add subject
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Subjects"
        subtitle={
          <>
            Every subject the school teaches, the same in every year. Give them to sections on{" "}
            {can("academics.sectionSubjects.read") ? <Link to={SETUP_PATHS.curriculum}>Curriculum</Link> : "Curriculum"}.
          </>
        }
        actions={addButton}
      />
      <Card flush>
        <div className="filter-bar">
          <Field label="Search" className="filter-wide">
            <SearchInput placeholder="Name or code" value={search} onChange={e => setSearch(e.target.value)} />
          </Field>
          <span className="muted">{!list.isLoading && `${list.subjects.length} subject${list.subjects.length === 1 ? "" : "s"}`}</span>
        </div>
        <DataTable
          rows={list.isLoading ? undefined : rows}
          rowKey={s => s.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          onRowClick={s => setDrawer({ subject: s })}
          empty={
            q ? (
              <EmptyState icon={<BookOpen />} title="No subject matches" message={`Nothing named or coded “${search.trim()}”.`} />
            ) : (
              <EmptyState
                icon={<BookOpen />}
                title="No subjects yet"
                message="Add the subjects the school teaches once; every class and year picks from this list."
                actions={addButton}
              />
            )
          }
          columns={[
            { key: "code", header: "Code", width: 100, render: s => <span className="mono">{s.subjectCode}</span> },
            { key: "name", header: "Subject", render: s => <strong style={{ fontWeight: 550 }}>{s.subjectName}</strong> },
            { key: "type", header: "Type", width: 110, render: s => subjectTypeLabel(s.subjectType) || <span className="muted">—</span> },
            {
              key: "default",
              header: "In a class",
              width: 120,
              render: s => (s.isOptional ? <Badge tone="info">Optional</Badge> : <Badge>Required</Badge>)
            },
            { key: "description", header: "Note", render: s => <span className="muted">{s.description || "—"}</span> }
          ]}
        />
      </Card>
      <SubjectDrawer open={!!drawer} subject={drawer?.subject ?? null} subjects={list.subjects} canEdit={canEdit} onClose={() => setDrawer(null)} />
    </Page>
  );
}
