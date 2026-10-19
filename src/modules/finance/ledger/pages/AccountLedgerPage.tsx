/* FI-13 · Account ledger: one account's lines with a running balance, opening and closing balance */
import { Link, useParams } from "react-router-dom";
import { ListOrdered } from "lucide-react";
import { useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, ErrorState, Kpi, PageHeader, Skeleton, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMoney } from "../../shared";
import { Amount } from "../../shared/components/FinanceStatus";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { ACCOUNT_TYPE_LABELS, accountLabel, sourceLabel, useAccount, useAccountLedger, type LedgerLine } from "../api/ledger";

const DEFAULTS = { from: "", to: "", studentId: "" };

export default function AccountLedgerPage() {
  const { accountId = "" } = useParams();
  const money = useMoney();
  const { params, setParam, setParams, setPage } = useListParams(DEFAULTS, { limit: 50 });
  const account = useAccount(accountId);
  const from = params.from && params.to && params.from > params.to ? params.to : params.from;
  const ledger = useAccountLedger(accountId, {
    from: from || undefined,
    to: params.to || undefined,
    studentId: params.studentId || undefined,
    page: params.page,
    limit: params.limit
  });
  const meta = ledger.data?.meta;
  const a = account.data;
  const filtered = !!(params.from || params.to || params.studentId);

  const columns: Column<LedgerLine>[] = [
    { key: "entryDate", header: "Date", render: l => <span className="nowrap">{formatDate(l.entryDate)}</span> },
    {
      key: "entryNumber",
      header: "Entry no.",
      render: l => (
        <Link to={OPS_PATHS.journalEntry(l.entryId)} className="mono nowrap" onClick={e => e.stopPropagation()}>
          {l.entryNumber}
        </Link>
      )
    },
    {
      key: "narration",
      header: "Narration",
      render: l => (
        <div>
          <div>{l.narration}</div>
          {l.memo && l.memo !== l.narration && <div className="small muted">{l.memo}</div>}
        </div>
      )
    },
    { key: "sourceType", header: "Source", render: l => <span className="nowrap">{sourceLabel(l.sourceType)}</span> },
    { key: "debit", header: "Debit", align: "right", render: l => <Amount value={l.debit} format={money} dashZero /> },
    { key: "credit", header: "Credit", align: "right", render: l => <Amount value={l.credit} format={money} dashZero /> },
    { key: "balance", header: "Balance", align: "right", render: l => <Amount value={l.balance} format={money} /> }
  ];

  if (account.error) return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;

  const kpi = (v: number | undefined) => (v === undefined ? <Skeleton width={90} height={22} /> : money(v));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Accounts", to: OPS_PATHS.accounts }, { label: a ? a.code : "…" }]}
        title={a ? accountLabel(a) : <Skeleton width={220} height={24} />}
        subtitle={
          a
            ? `${ACCOUNT_TYPE_LABELS[a.accountType]}${a.isContra ? " (contra)" : ""} · normal balance ${a.normalBalance === "DEBIT" ? "debit" : "credit"}${a.description ? ` · ${a.description}` : ""}`
            : " "
        }
      />
      <div className="kpis">
        <Kpi label={meta?.from ? `Opening on ${formatDate(meta.from)}` : "Opening balance"} value={kpi(meta?.openingBalance)} />
        <Kpi label="Debits" value={kpi(meta?.debits)} />
        <Kpi label="Credits" value={kpi(meta?.credits)} />
        <Kpi label={meta?.to ? `Closing on ${formatDate(meta.to)}` : "Closing balance"} value={kpi(meta?.closingBalance)} />
      </div>
      <Card flush>
        <div className="filter-bar">
          <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="Any student" />
        </div>
        <DataTable
          columns={columns}
          rows={ledger.data?.rows}
          rowKey={l => l.lineId}
          loading={ledger.isLoading}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          meta={meta}
          onPageChange={setPage}
          empty={
            <EmptyState
              icon={<ListOrdered />}
              title={filtered ? "No lines match these filters." : "Nothing posted to this account yet"}
              actions={filtered && <Button onClick={() => setParams(DEFAULTS)}>Clear filters</Button>}
            />
          }
        />
      </Card>
    </>
  );
}
