/* AC-12 · Enrollments and promotion: a section's roster, enrolling and promoting students, and
   the roll-number rule (the rule card and renumbering dialog come from classes/) */
import { useState } from "react";
import { ArrowUpRight, ListOrdered, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useListParams } from "@/common/hooks";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, Select, StatusBadge } from "@/common/ui";
import { RollNumberRuleCard } from "../../classes/components/RollNumberRuleCard";
import { RollNumbersDialog } from "../../classes/components/RollNumbersDialog";
import type { RollTarget } from "../../classes/api/rollNumbers";
import { SectionSelect, sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { PROMOTION_PAGE } from "../../shared/utils/paths";
import { admissionLabel, studentLabel, useRoster, type Enrollment } from "../api/enrollments";
import { EnrollDialog, PromoteDialog } from "../components/EnrollmentDialogs";
import { EnrollmentDrawer } from "../components/EnrollmentDrawer";
import "../../classes/components/classes.css";
import "../../shared/components/setup.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "LEFT", label: "Left" },
  { value: "ALL", label: "Everyone" }
];

export default function EnrollmentsPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setParams } = useListParams({ section: "", status: "ACTIVE" });
  const { byId } = useSectionOptions();
  const roster = useRoster(params.section);
  const [open, setOpen] = useState<Enrollment | null>(null);
  const [promoting, setPromoting] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [roll, setRoll] = useState<{ target: RollTarget; label: string } | null>(null);

  const canEnroll = can("academics.enrollments.create") && can("users.students.read") && !readOnly;
  const canPromote = can("academics.enrollments.promote") && !readOnly;
  const canRenumber = can("academics.enrollments.assignRollNumbers") && !readOnly;
  const section = byId.get(params.section);
  const label = section ? sectionTitle(section) : "the section";

  const all = roster.data ? [...roster.data].sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true })) : undefined;
  const rows = all?.filter(e => params.status === "ALL" || e.status === params.status);
  const active = all?.filter(e => e.status === "ACTIVE").length ?? 0;
  const left = (all?.length ?? 0) - active;

  return (
    <Page>
      <PageHeader
        title="Enrollments"
        subtitle={`Who is in each section in ${year?.yearName ?? "the year chosen in the header"}, their roll numbers, and promotion to the next year`}
        actions={
          <>
            {canPromote && (
              <ButtonLink to={params.section ? `${PROMOTION_PAGE}?from=${params.section}` : PROMOTION_PAGE} icon={<ArrowUpRight />}>
                Promote a section
              </ButtonLink>
            )}
            {canEnroll && (
              <Button variant="primary" icon={<UserPlus />} onClick={() => setEnrolling(true)}>
                Enroll a student
              </Button>
            )}
          </>
        }
      />
      <div className="enrollments-layout">
        <Card
          flush
          title={section ? label : "Roster"}
          subtitle={all && section ? `${active} active${left ? ` · ${left} left` : ""}${section.capacity ? ` · capacity ${section.capacity}` : ""}` : "Pick a section to see its students"}
          actions={
            canRenumber &&
            params.section && (
              <Button
                size="sm"
                icon={<ListOrdered />}
                disabled={!active}
                title={active ? `Renumber ${label} by the school's rule` : "No active students"}
                onClick={() => setRoll({ target: { sectionId: params.section }, label })}
              >
                Renumber
              </Button>
            )
          }
        >
          <div className="filter-bar">
            <SectionSelect value={params.section} placeholder="Pick a section" onChange={e => setParams({ section: e.target.value })} />
            <Select label="Status" options={STATUS_OPTIONS} value={params.status} required onChange={e => setParams({ status: e.target.value })} />
          </div>
          {!params.section ? (
            <EmptyState icon={<Users />} title="Pick a section" message="Its students for the year are listed by roll number." />
          ) : (
            <DataTable
              rows={rows}
              rowKey={e => e.id}
              loading={roster.isLoading}
              error={roster.error}
              onRetry={() => void roster.refetch()}
              onRowClick={setOpen}
              empty={
                <EmptyState
                  icon={<Users />}
                  title={all?.length ? (params.status === "LEFT" ? "Nobody has left this section" : "No active students") : `No students in ${label} yet`}
                  message={all?.length ? undefined : "Admit new students, enroll existing ones, or promote last year's section into it."}
                  actions={
                    canEnroll &&
                    !all?.length && (
                      <Button variant="primary" icon={<UserPlus />} onClick={() => setEnrolling(true)}>
                        Enroll a student
                      </Button>
                    )
                  }
                />
              }
              columns={[
                { key: "roll", header: "Roll", width: 100, render: e => (e.rollNumber ? <span className="mono">{e.rollNumber}</span> : <span className="muted">—</span>) },
                { key: "name", header: "Name", render: e => <span style={{ fontWeight: 550 }}>{studentLabel(e)}</span> },
                { key: "code", header: "Code", render: e => <span className="mono small">{e.student.studentCode}</span> },
                { key: "admission", header: "Admission no.", render: e => <span className="mono small">{e.student.admissionNumber ?? "—"}</span> },
                { key: "type", header: "Type", render: e => <Badge>{admissionLabel(e.admissionType)}</Badge> },
                { key: "status", header: "Status", render: e => <StatusBadge status={e.status} /> }
              ]}
            />
          )}
        </Card>
        {can("academics.enrollments.readPolicy") && (
          <div className="stack">
            <RollNumberRuleCard onAssignAll={() => setRoll({ target: { all: true }, label: `all of ${year?.yearName ?? "the year"}` })} />
            <Card title="How numbering works">
              <ul className="small muted enrollments-notes">
                <li>New admissions and transfers get the next number at the end of the section, until it is renumbered.</li>
                <li>Promoting a section numbers the new section by the rule.</li>
                <li>Students who left are numbered after the current ones.</li>
                <li>Changing the rule renumbers nobody: renumber a section, a class (on Classes & sections) or the whole year.</li>
              </ul>
            </Card>
          </div>
        )}
      </div>
      {open && (
        <EnrollmentDrawer
          key={open.id}
          enrollment={open}
          onClose={() => setOpen(null)}
          onPromote={() => {
            setPromoting(open);
            setOpen(null);
          }}
        />
      )}
      {promoting && canPromote && <PromoteDialog enrollment={promoting} onClose={() => setPromoting(null)} />}
      {enrolling && <EnrollDialog sectionId={params.section} onClose={() => setEnrolling(false)} />}
      {roll && <RollNumbersDialog target={roll.target} label={roll.label} onClose={() => setRoll(null)} />}
    </Page>
  );
}
