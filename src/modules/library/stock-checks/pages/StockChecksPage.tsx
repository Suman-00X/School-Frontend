/* LB-07 · Stock checks: the list, and starting one */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useForm, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, Dialog, EmptyState, Page, TextInput, Textarea, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { StockCheck } from "../../shared/api/types";
import { LibraryIntro } from "../../shared/components/LibraryBits";
import { STOCK_CHECKS_PATH, useStartStockCheck } from "../api/stockChecks";

const count = (n: number | null) => (n === null ? <span className="muted">—</span> : <span className="num">{n}</span>);

export default function StockChecksPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setPage } = useListParams({});
  const list = useApiList<StockCheck>(STOCK_CHECKS_PATH, params);
  const [starting, setStarting] = useState(false);
  const open = list.rows?.find(c => c.status === "OPEN");

  const startButton = can("library.stockChecks.manage") && (
    <Button variant="primary" icon={<Plus />} onClick={() => setStarting(true)}>
      Start stock check
    </Button>
  );

  const columns: Column<StockCheck>[] = [
    {
      key: "title",
      header: "Stock check",
      render: c => (
        <div>
          <div className="person-name">{c.title}</div>
          {c.notes && <div className="person-sub">{c.notes}</div>}
        </div>
      )
    },
    { key: "status", header: "Status", render: c => (c.status === "OPEN" ? <Badge tone="info" dot>Open</Badge> : <Badge dot>Closed</Badge>) },
    { key: "startedOn", header: "Started", render: c => <span className="nowrap">{formatDate(c.startedOn)}</span> },
    { key: "closedOn", header: "Closed", render: c => (c.closedOn ? <span className="nowrap">{formatDate(c.closedOn)}</span> : <span className="muted">—</span>) },
    { key: "expectedCount", header: "Expected", align: "right", render: c => count(c.expectedCount) },
    { key: "foundCount", header: "Found", align: "right", render: c => count(c.foundCount) },
    { key: "missingCount", header: "Missing", align: "right", render: c => (c.missingCount ? <span className="num text-danger">{c.missingCount}</span> : count(c.missingCount)) },
    { key: "unexpectedCount", header: "Unexpected", align: "right", render: c => count(c.unexpectedCount) }
  ];

  return (
    <Page>
      <LibraryIntro actions={startButton}>
        Scan every copy on the shelves; copies not scanned are marked missing when the check closes. One check is open at a time.
      </LibraryIntro>
      <Card flush>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={c => navigate(`/library/stock-checks/${c.id}`)}
          empty={<EmptyState icon={<ClipboardCheck />} title="No stock checks yet" message="Start one to count what is on the shelves." actions={startButton} />}
        />
      </Card>
      <StartDialog open={starting} onClose={() => setStarting(false)} openCheck={open} />
    </Page>
  );
}

function StartDialog({ open, onClose, openCheck }: { open: boolean; onClose: () => void; openCheck?: StockCheck }) {
  const toast = useToast();
  const navigate = useNavigate();
  const start = useStartStockCheck();
  const form = useForm({ title: "", notes: "" });
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (open) {
      const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
      form.reset({ title: `Stock check ${month}`, notes: "" });
      setConflict(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.values.title.trim()) return form.setErrors({ title: "is required" });
    form.setFormError(null);
    start.mutate(
      { title: form.values.title.trim(), ...(form.values.notes.trim() ? { notes: form.values.notes.trim() } : {}) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`/library/stock-checks/${res.data.id}`);
        },
        onError: err => {
          if (isApiError(err) && err.status === 409) setConflict(true);
          form.setServerErrors(err);
        }
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start a stock check"
      footerStatus={
        conflict && openCheck ? (
          <span>
            {form.formError} <Link to={`/library/stock-checks/${openCheck.id}`}>Open it</Link>
          </span>
        ) : (
          form.formError
        )
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="start-check" variant="primary" loading={start.isPending}>
            Start
          </Button>
        </>
      }
    >
      <form id="start-check" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Name" required autoFocus maxLength={200} {...form.text("title")} />
        <Textarea label="Notes" rows={2} maxLength={1000} {...form.text("notes")} placeholder="e.g. Fiction shelves first, then reference" />
        <p className="small muted">Copies on the shelf, held at the desk or damaged are expected. Books on loan, lost or withdrawn are not.</p>
      </form>
    </Dialog>
  );
}
