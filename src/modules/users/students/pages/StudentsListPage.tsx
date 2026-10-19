import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Download, FileUp, GraduationCap, UserPlus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { api } from "@/common/api";
import { Button, ButtonLink, Card, DataTable, EmptyState, Menu, MenuItem, Page, PageHeader, PersonCell, Switch, useToast, type Column } from "@/common/ui";
import { formatDate, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { useStudents, type Student } from "../api/students";
import { SectionRoster } from "../components/SectionRoster";

/* PE-01: every student (the API has no search or filters: gap), or one section's roster */
export default function StudentsListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParams, setPage } = useListParams({ view: "", classId: "", sectionId: "" });
  const bySection = params.view === "section";
  const canBrowse = can("academics.enrollments.read") && can("academics.classes.read") && can("academics.sections.read");
  const list = useStudents({ page: params.page, limit: params.limit }, !bySection);

  /* Selection is by account (what invitations take); names label the skipped dialog across pages */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const select = (next: Set<string>) => {
    setSelected(next);
    setNames(n => ({ ...n, ...Object.fromEntries((list.rows ?? []).map(r => [r.userId, fullName(r.user)])) }));
  };

  const columns: Column<Student>[] = [
    { key: "studentCode", header: "Student code", width: 150, render: s => <span className="mono">{s.studentCode}</span> },
    { key: "admissionNumber", header: "Admission no.", width: 130 },
    { key: "name", header: "Name", render: s => <PersonCell name={fullName(s.user)} /> },
    { key: "email", header: "Email", render: s => s.user.email },
    { key: "phone", header: "Phone", render: s => s.user.phone ?? <span className="muted">—</span> },
    { key: "admissionDate", header: "Admitted", width: 120, render: s => (s.admissionDate ? formatDate(s.admissionDate) : <span className="muted">—</span>) }
  ];

  const admitButton = (primary: boolean) =>
    can("users.students.admit") && (
      <ButtonLink to="/users/students/new" variant={primary ? "primary" : "default"} icon={<UserPlus />}>
        Admit student
      </ButtonLink>
    );
  const importButton = can("administration.imports.create") && (
    <ButtonLink to="/administration/imports" icon={<FileUp />}>
      {list.meta?.total === 0 ? "Import from CSV" : "Import"}
    </ButtonLink>
  );

  return (
    <Page>
      <PageHeader
        title="Students"
        actions={
          <>
            {importButton}
            {can("reports.exports.students") && <ExportMenu />}
            {admitButton(true)}
          </>
        }
      />
      {canBrowse && (
        <div style={{ marginBottom: 12 }}>
          <Switch
            label="Browse by section"
            checked={bySection}
            onChange={on => setParams({ view: on ? "section" : "", classId: "", sectionId: "" })}
          />
        </div>
      )}
      <Card flush>
        {bySection ? (
          <SectionRoster
            classId={params.classId}
            sectionId={params.sectionId}
            page={params.page}
            onChange={setParams}
            onPageChange={setPage}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={list.rows}
            rowKey={s => s.userId}
            loading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            meta={list.meta}
            onPageChange={setPage}
            onRowClick={s => navigate(`/users/students/${s.id}`)}
            selection={can("auth.credentials.invite") ? { selected, onChange: select } : undefined}
            bulkActions={<InviteButton size="sm" userIds={[...selected]} names={names} onDone={() => setSelected(new Set())} />}
            empty={
              <EmptyState
                icon={<GraduationCap />}
                title="No students yet"
                message="Admit students one by one, or import a class list from a CSV file."
                actions={
                  <>
                    {admitButton(true)}
                    {importButton}
                  </>
                }
              />
            }
          />
        )}
      </Card>
    </Page>
  );
}

/* Export the list for the header's year (XLSX or CSV) */
function ExportMenu() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (format: "xlsx" | "csv") => {
    setBusy(true);
    try {
      await api.download("/reports/exports/students", { format }, `students.${format}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Menu
      trigger={(toggle, open) => (
        <Button icon={<Download />} loading={busy} onClick={toggle} aria-expanded={open} aria-haspopup="menu">
          Export <ChevronDown size={14} />
        </Button>
      )}
    >
      {close => (
        <>
          <MenuItem
            onClick={() => {
              close();
              void run("xlsx");
            }}
          >
            Excel (.xlsx)
          </MenuItem>
          <MenuItem
            onClick={() => {
              close();
              void run("csv");
            }}
          >
            CSV
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
