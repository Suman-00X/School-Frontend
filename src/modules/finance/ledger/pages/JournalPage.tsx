/* FI-13 · Journal: every entry, newest first; a row opens its drawer (/finance/ledger/journal-entries/:entryId) */
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { NotebookPen, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, PageHeader, Select, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMoney } from "../../shared";
import { Amount } from "../../shared/components/FinanceStatus";
import { actorName } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { dateRange } from "../../payments/utils/dateRange";
import { SOURCE_TYPES, sourceLabel, useAccountOptions, useJournal, type JournalEntry } from "../api/ledger";
import { JournalEntryDrawer } from "../components/JournalEntryDrawer";

const DEFAULTS = { from: "", to: "", sourceType: "", accountId: "", studentId: "" };

export default function JournalPage() {
  const { entryId = null } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const money = useMoney();
  const accounts = useAccountOptions();
  const { params, setParam, setParams, setPage } = useListParams(DEFAULTS);
  const list = useJournal({
    ...dateRange(params.from, params.to),
    sourceType: params.sourceType || undefined,
    accountId: params.accountId || undefined,
    studentId: params.studentId || undefined,
    page: params.page,
    limit: params.limit
  });
  const filtered = Object.keys(DEFAULTS).some(k => params[k as keyof typeof DEFAULTS]);
  const canPost = can("finance.ledger.post");
  /* Reversals on this page name the entries they reverse */
  const reversed = new Set((list.rows ?? []).map(e => e.reversalOfId).filter(Boolean));

  const open = (id: string | null) => navigate({ pathname: id ? OPS_PATHS.journalEntry(id) : OPS_PATHS.journal, search: location.search });

  const columns: Column<JournalEntry>[] = [
    { key: "entryNumber", header: "Entry no.", render: e => <span className="mono nowrap">{e.entryNumber}</span> },
    { key: "entryDate", header: "Date", render: e => <span className="nowrap">{formatDate(e.entryDate)}</span> },
    {
      key: "narration",
      header: "Narration",
      render: e => (
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <span style={{ minWidth: 0 }}>{e.narration}</span>
          {e.reversalOfId && <Badge tone="warning">Reversal</Badge>}
          {reversed.has(e.id) && <Badge>Reversed</Badge>}
        </div>
      )
    },
    { key: "sourceType", header: "Source", render: e => <span className="nowrap">{sourceLabel(e.sourceType)}</span> },
    { key: "total", header: "Total", align: "right", render: e => <Amount value={e.total} format={money} /> },
    { key: "poster", header: "Posted by", render: e => actorName(e.poster) || <span className="muted">Automatic</span> }
  ];

  return (
    <>
      <PageHeader
        title="Journal entries"
        subtitle="Entries are posted automatically by invoices, payments, credit, refunds and settlements. Manual entries are for adjustments."
        actions={
          canPost && (
            <ButtonLink variant="primary" icon={<Plus />} to={OPS_PATHS.newJournalEntry}>
              New manual entry
            </ButtonLink>
          )
        }
      />
      <Card flush>
        <div className="filter-bar">
          <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
          <Select
            label="Source"
            className="select-sm"
            value={params.sourceType}
            placeholder="Any source"
            onChange={e => setParam("sourceType", e.target.value)}
            options={SOURCE_TYPES.map(t => ({ value: t, label: sourceLabel(t) }))}
          />
          <Select
            label="Account"
            className="select-sm"
            fieldClassName="filter-wide"
            value={params.accountId}
            placeholder="Any account"
            searchable
            onChange={e => setParam("accountId", e.target.value)}
            options={accounts.options}
          />
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="Any student" />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={e => e.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={e => open(e.id)}
          empty={
            <EmptyState
              icon={<NotebookPen />}
              title={filtered ? "No entries match these filters." : "The journal is empty"}
              message={filtered ? undefined : "The books start on the day the school starts using the system. Fees and payments post here as they happen."}
              actions={filtered && <Button onClick={() => setParams(DEFAULTS)}>Clear filters</Button>}
            />
          }
        />
      </Card>
      <JournalEntryDrawer entryId={entryId} onClose={() => open(null)} />
    </>
  );
}
