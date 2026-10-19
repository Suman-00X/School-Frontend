/* FI-12 · Gateway settlements: payouts from Razorpay into the bank, imported and posted to the ledger */
import { useState } from "react";
import { Link } from "react-router-dom";
import { DownloadCloud, Landmark } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation, useListParams } from "@/common/hooks";
import { Button, ButtonLink, Card, DataTable, Dialog, EmptyState, PageHeader, TextInput, useToast, type Column } from "@/common/ui";
import { formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import { isApiError } from "@/common/api";
import { SETUP_PATHS, useMoney } from "../../shared";
import { Amount } from "../../shared/components/FinanceStatus";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { dateRange } from "../../payments/utils/dateRange";
import { importSettlements, useSettlements, type Settlement } from "../api/settlements";

export default function SettlementsPage() {
  const { can } = useAuth();
  const money = useMoney();
  const { params, setParam, setParams, setPage } = useListParams({ from: "", to: "" });
  const list = useSettlements({ ...dateRange(params.from, params.to), page: params.page, limit: params.limit });
  const [importing, setImporting] = useState(false);
  const canImport = can("finance.settlements.import");
  const canLedger = can("finance.ledger.read");
  const filtered = !!(params.from || params.to);

  const columns: Column<Settlement>[] = [
    { key: "settledAt", header: "Settled on", render: s => <span className="nowrap" title={formatDateTime(s.settledAt)}>{formatDate(s.settledAt)}</span> },
    { key: "settlementId", header: "Settlement id", render: s => <span className="mono">{s.settlementId}</span> },
    { key: "utr", header: "UTR", render: s => (s.utr ? <span className="mono">{s.utr}</span> : <span className="muted">—</span>) },
    { key: "amount", header: "Amount received", align: "right", render: s => <Amount value={s.amount} format={money} /> },
    { key: "fees", header: "Gateway fees", align: "right", render: s => <Amount value={s.fees} format={money} dashZero /> },
    { key: "tax", header: "Tax", align: "right", render: s => <Amount value={s.tax} format={money} dashZero /> },
    {
      key: "journalEntry",
      header: "Journal entry",
      render: s =>
        s.journalEntry ? (
          canLedger ? (
            <Link to={OPS_PATHS.journalEntry(s.journalEntry.id)} className="mono">
              {s.journalEntry.entryNumber}
            </Link>
          ) : (
            <span className="mono">{s.journalEntry.entryNumber}</span>
          )
        ) : (
          <span className="muted">—</span>
        )
    }
  ];

  return (
    <>
      <PageHeader
        title="Gateway settlements"
        subtitle="Imported automatically every day. Do not also enter payouts by hand in the journal."
        actions={
          canImport && (
            <Button icon={<DownloadCloud />} onClick={() => setImporting(true)}>
              Import now
            </Button>
          )
        }
      />
      <Card flush>
        <div className="filter-bar">
          <TextInput label="Settled from" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={s => s.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={
            filtered ? (
              <EmptyState icon={<Landmark />} title="No settlements in these dates." actions={<Button onClick={() => setParams({ from: "", to: "" })}>Clear dates</Button>} />
            ) : (
              <EmptyState
                icon={<Landmark />}
                title="No settlements yet"
                message="When the school takes payments online, Razorpay pays them into the bank in batches. Each payout is imported here with its fees. Set up online payments first if you haven't."
                actions={
                  can("finance.paymentSettings.manage") && (
                    <ButtonLink to={SETUP_PATHS.settings}>Online payment settings</ButtonLink>
                  )
                }
              />
            )
          }
        />
      </Card>
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const run = useApiMutation(importSettlements, { invalidate: ["/finance/settlements", "/finance/ledger"] });

  const submit = () => {
    setError(null);
    setFieldErrors({});
    run.mutate(
      { from: from || undefined, to: to || undefined },
      {
        onSuccess: res => {
          const r = res.data;
          toast.success(
            `${r.found} found, ${r.imported} imported, ${r.alreadyImported} already imported, ${r.notYetProcessed} not yet paid out`
          );
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) setFieldErrors(err.fieldErrors());
          setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import settlements"
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={run.isPending} onClick={submit}>
            Import
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">Reads the payouts Razorpay made in these dates and posts the new ones to the ledger. Payouts already imported are skipped.</p>
        <div className="form-grid">
          <TextInput type="date" label="From" value={from} max={to || todayIso()} onChange={e => setFrom(e.target.value)} hint="Empty: 7 days ago" error={fieldErrors.from} />
          <TextInput type="date" label="To" value={to} min={from || undefined} max={todayIso()} onChange={e => setTo(e.target.value)} hint="Empty: today" error={fieldErrors.to} />
        </div>
      </div>
    </Dialog>
  );
}
