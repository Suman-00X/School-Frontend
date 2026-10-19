/* FI-05 · Concession grants (Grants): who has which concession, per year */
import { useMemo, useState } from "react";
import { Gift, Plus, Undo2 } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, PersonCell, Select, useConfirm, useToast, type Option } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { UserName } from "../../shared";
import { CATEGORY_LABELS, GRANTS_PATH, grantStudentName, revokeGrant, useConcessionOptions, valueLabel, type Grant } from "../api/concessions";
import { GrantDialog } from "../components/GrantDialog";

/* The year filter: absent = the header's year, "all" = every year */
const ALL = "all";

export default function ConcessionGrantsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { years, selected } = useAcademicYear();
  const { params, setParam, setPage } = useListParams({ concessionId: "", academicYearId: "", studentId: "" });
  const yearFilter = params.academicYearId === ALL ? "" : params.academicYearId || selected?.id || "";
  const list = useApiList<Grant>(GRANTS_PATH, { ...params, academicYearId: yearFilter });
  const concessions = useConcessionOptions();
  const [dialog, setDialog] = useState(false);
  const canManage = can("finance.concessions.manage");
  const revoke = useApiMutation(revokeGrant, { invalidate: [GRANTS_PATH, "/finance/invoices", "/finance/students"] });

  const yearName = useMemo(() => new Map(years.map(y => [y.id, y])), [years]);
  const yearOptions = useMemo<Option[]>(() => [{ value: ALL, label: "All years" }, ...years.map(y => ({ value: y.id, label: y.yearName, description: y.isCurrent ? "Current year" : undefined }))], [years]);

  const askRevoke = async (g: Grant) => {
    const name = grantStudentName(g);
    const year = yearName.get(g.academicYearId)?.yearName ?? "the year";
    const ok = await confirm({
      title: `Revoke ${g.concession.name} for ${name}?`,
      message: `${name} loses ${g.concession.name} (${valueLabel(g.concession)}) for ${year}. Only invoices with nothing paid are recalculated; paid invoices keep the discount.`,
      confirmLabel: "Revoke"
    });
    if (ok) revoke.mutate(g.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const filtered = !!(params.concessionId || params.studentId);
  const grantButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDialog(true)}>
      Grant concession
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader title="Concession grants" subtitle="Students who get a concession, per year. Granting or revoking recalculates their unpaid invoices." actions={grantButton} />
      <Card flush>
        <div className="filter-bar">
          <Select label="Concession" placeholder="All concessions" options={concessions.options} value={params.concessionId} onChange={e => setParam("concessionId", e.target.value)} error={undefined} />
          <Select
            label="Year"
            options={yearOptions}
            required
            value={params.academicYearId || selected?.id || ALL}
            onChange={e => setParam("academicYearId", e.target.value === selected?.id ? "" : e.target.value)}
            error={undefined}
          />
          <StudentSelect label="Student" placeholder="Any student" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} error={undefined} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={g => g.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={
            filtered ? (
              <EmptyState title="Nothing matches" message="No grants with these filters." />
            ) : (
              <EmptyState
                icon={<Gift />}
                title={yearFilter ? `No concessions granted for ${yearName.get(yearFilter)?.yearName ?? "this year"}` : "No concessions granted yet"}
                message="Grant a concession to a student; their unpaid invoices of the year are recalculated at once."
                actions={grantButton}
              />
            )
          }
          columns={[
            { key: "student", header: "Student", render: g => <PersonCell name={grantStudentName(g)} sub={g.student.admissionNumber} /> },
            {
              key: "concession",
              header: "Concession",
              render: g => (
                <div style={{ minWidth: 0 }}>
                  <div>{g.concession.name}</div>
                  <div className="small muted amount">{valueLabel(g.concession)}</div>
                </div>
              )
            },
            { key: "category", header: "Category", render: g => <Badge tone="info">{CATEGORY_LABELS[g.concession.category]}</Badge> },
            { key: "year", header: "Year", width: 90, render: g => yearName.get(g.academicYearId)?.yearName ?? <span className="muted">—</span> },
            { key: "reason", header: "Reason", render: g => <span className="muted">{g.reason || "—"}</span> },
            { key: "grantedBy", header: "Granted by", render: g => <UserName id={g.grantedBy} /> },
            { key: "createdAt", header: "Date", width: 110, render: g => <span className="nowrap">{formatDate(g.createdAt)}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 52,
              render: g =>
                canManage && (
                  <div className="row-actions">
                    <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => void askRevoke(g)} aria-label={`Revoke ${g.concession.name} for ${grantStudentName(g)}`} title="Revoke" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <GrantDialog open={dialog} onClose={() => setDialog(false)} preset={{ concessionId: params.concessionId, studentId: params.studentId }} />
    </div>
  );
}
