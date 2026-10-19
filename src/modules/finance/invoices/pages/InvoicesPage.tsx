/* FI-07 · Invoices: the year's invoices with filters; generate invoices from a fee structure */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, ReceiptText } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Field, Page, Select, Switch, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMoney } from "../../shared";
import { PageIntro } from "../../shared/components/PageIntro";
import { Amount, InvoiceStatus, StudentCell } from "../../shared/components/FinanceStatus";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { useInvoices, type Invoice } from "../api/invoices";
import { usePlanOptions, useStructureOptions } from "../api/pickers";
import { GenerateInvoicesDialog } from "../components/GenerateInvoicesDialog";

const STATUS_OPTIONS = [
  { value: "ISSUED", label: "Issued", description: "Nothing paid yet" },
  { value: "PARTIALLY_PAID", label: "Part paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" }
];

export default function InvoicesPage() {
  const { can } = useAuth();
  const { readOnly, selected: year } = useAcademicYear();
  const navigate = useNavigate();
  const money = useMoney();
  const { params, setParam, setParams, setPage } = useListParams({ status: "", feeStructureId: "", installmentPlanId: "", overdue: "", studentId: "" });
  const list = useInvoices(params);
  const structures = useStructureOptions();
  const plans = usePlanOptions();
  const [generating, setGenerating] = useState(false);

  const canIssue = can("finance.invoices.issue") && !readOnly;
  const filtered = !!(params.status || params.feeStructureId || params.installmentPlanId || params.overdue || params.studentId);

  const columns: Column<Invoice>[] = [
    { key: "invoiceNumber", header: "Invoice no.", render: i => <span className="mono nowrap">{i.invoiceNumber}</span> },
    { key: "student", header: "Student", render: i => <StudentCell student={i.student} /> },
    { key: "structure", header: "Structure", render: i => i.structure?.name ?? <span className="muted">—</span> },
    { key: "installment", header: "Installment", render: i => (i.installment ? `${i.installment.name}${i.plan ? ` · ${i.plan.name}` : ""}` : <span className="muted">—</span>) },
    { key: "dueDate", header: "Due", render: i => <span className="nowrap">{formatDate(i.dueDate)}</span> },
    { key: "total", header: "Total", align: "right", render: i => <Amount value={i.total} format={money} /> },
    { key: "amountPaid", header: "Paid", align: "right", render: i => <Amount value={i.amountPaid} format={money} dashZero /> },
    { key: "balance", header: "Balance", align: "right", render: i => <Amount value={i.status === "CANCELLED" ? null : i.balance} format={money} dashZero /> },
    { key: "status", header: "Status", render: i => <InvoiceStatus status={i.status} overdue={i.isOverdue} /> }
  ];

  return (
    <Page>
      <PageIntro
        actions={
          canIssue && (
            <Button variant="primary" icon={<FilePlus2 />} onClick={() => setGenerating(true)}>
              Generate invoices
            </Button>
          )
        }
      >
        Fee invoices of {year?.yearName ?? "the selected year"}, newest due date first. Open one to see its lines, payments and late fee.
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="Any student" />
          <Select label="Status" className="select-sm" value={params.status} onChange={e => setParam("status", e.target.value)} placeholder="Any status" options={STATUS_OPTIONS} />
          {structures.allowed && (
            <Select
              label="Fee structure"
              className="select-sm"
              value={params.feeStructureId}
              onChange={e => setParam("feeStructureId", e.target.value)}
              placeholder="Any structure"
              options={structures.options}
            />
          )}
          {plans.allowed && (
            <Select
              label="Installment plan"
              className="select-sm"
              value={params.installmentPlanId}
              onChange={e => setParam("installmentPlanId", e.target.value)}
              placeholder="Any plan"
              options={plans.options}
            />
          )}
          <Field label="Show">
            <div style={{ height: 32, display: "flex", alignItems: "center" }}>
              <Switch label="Overdue only" checked={params.overdue === "true"} onChange={on => setParam("overdue", on ? "true" : "")} />
            </div>
          </Field>
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={i => i.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={i => navigate(OPS_PATHS.invoice(i.id))}
          empty={
            filtered ? (
              <EmptyState
                icon={<ReceiptText />}
                title="No invoices match these filters."
                actions={
                  <Button onClick={() => setParams({ status: "", feeStructureId: "", installmentPlanId: "", overdue: "", studentId: "" })}>Clear filters</Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ReceiptText />}
                title="No invoices this year yet"
                message="Invoices are generated from a fee structure, one per installment of each student's plan."
                actions={
                  canIssue && (
                    <Button variant="primary" icon={<FilePlus2 />} onClick={() => setGenerating(true)}>
                      Generate invoices
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>
      {generating && <GenerateInvoicesDialog onClose={() => setGenerating(false)} />}
    </Page>
  );
}
