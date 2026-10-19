/* FI-03 · Fee structures (list): what each class pays in the selected year */
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Star } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, ButtonLink, Card, DataTable, EmptyState, PageHeader, Select } from "@/common/ui";
import { feeStructurePath, SETUP_PATHS, useClassOptions, useMoney } from "../../shared";
import { lateFeeLabel, STRUCTURES_PATH, type FeeStructure } from "../api/feeStructures";

export default function FeeStructuresPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const money = useMoney();
  const { selected: year, readOnly } = useAcademicYear();
  const classes = useClassOptions();
  const { params, setParam, setPage } = useListParams({ classId: "" });
  const list = useApiList<FeeStructure>(STRUCTURES_PATH, params);
  const canManage = can("finance.feeStructures.manage") && !readOnly;

  const newButton = canManage && (
    <ButtonLink variant="primary" icon={<Plus />} to={`${SETUP_PATHS.feeStructures}/new`}>
      New structure
    </ButtonLink>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Fee structures"
        subtitle={`What each class pays in ${year?.yearName ?? "the year"}: annual amounts per fee head, the plans they can be paid by and the late fee.`}
        actions={newButton}
      />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Class"
            placeholder="All classes"
            options={classes.options}
            value={params.classId}
            onChange={e => setParam("classId", e.target.value)}
            error={undefined}
          />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={s => s.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={s => navigate(feeStructurePath(s.id))}
          empty={
            params.classId ? (
              <EmptyState
                title="No structure for this class"
                message="Only structures made for this class are listed. A structure for every class also applies to it."
              />
            ) : (
              <EmptyState
                icon={<Layers />}
                title={`No fee structures for ${year?.yearName ?? "this year"}`}
                message="A structure lists the annual amount of each fee head for a class (or every class), and the installment plans it can be paid by. Set up fee heads and installment plans first."
                actions={newButton}
              />
            )
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: s => (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 550 }}>{s.name}</div>
                  {s.description && <div className="small muted">{s.description}</div>}
                </div>
              )
            },
            { key: "class", header: "Class", render: s => s.class?.className ?? <span className="muted">Every class</span> },
            { key: "totalAmount", header: "Annual total", align: "right", render: s => <span className="amount">{money(s.totalAmount)}</span> },
            {
              key: "plans",
              header: "Plans",
              render: s => (
                <div className="chips">
                  {s.installmentPlans.map(p => (
                    <Badge key={p.id} tone={p.isDefault ? "primary" : "neutral"}>
                      {p.isDefault && <Star aria-label="Default" />}
                      {p.name}
                    </Badge>
                  ))}
                </div>
              )
            },
            {
              key: "lateFee",
              header: "Late fee",
              render: s => <span className={s.lateFeeRule ? undefined : "muted"}>{lateFeeLabel(s)}</span>
            }
          ]}
        />
      </Card>
    </div>
  );
}
