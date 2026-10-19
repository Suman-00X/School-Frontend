/* LB-02 · Closures: days the library is closed outside the school calendar */
import { useEffect, useState, type FormEvent } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useForm, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, Dialog, EmptyState, TextInput, Textarea, useConfirm, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { Closure } from "../../shared/api/types";
import { LibraryIntro } from "../../shared/components/LibraryBits";
import { daysInclusive, plural } from "../../shared/utils/labels";

const PATH = "/library/closures";
const HELP =
  "Only for days outside the school calendar (the break between two academic years, a renovation week). Fines skip these days, and due dates move past them.";

export default function ClosuresPage() {
  const { can } = useAuth();
  const canEdit = can("library.closures.manage");
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setPage } = useListParams({ from: "", to: "" });
  const list = useApiList<Closure>(PATH, params);
  const [adding, setAdding] = useState(false);
  const remove = useApiMutation((id: string) => api.delete<Closure>(`${PATH}/${id}`), { invalidate: [PATH] });

  const askRemove = async (c: Closure) => {
    const when = c.fromDate === c.toDate ? formatDate(c.fromDate) : `${formatDate(c.fromDate)} – ${formatDate(c.toDate)}`;
    const ok = await confirm({
      title: `Remove the closure on ${when}?`,
      message: `“${c.reason}”. Fines and due dates count these days again from now on.`,
      confirmLabel: "Remove closure"
    });
    if (ok) remove.mutate(c.id, { onSuccess: res => toast.success(res.message || "Closure removed"), onError: err => toast.error(err) });
  };

  const addButton = canEdit && (
    <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
      Add closure
    </Button>
  );

  const columns: Column<Closure>[] = [
    { key: "fromDate", header: "From", render: c => <span className="nowrap">{formatDate(c.fromDate)}</span> },
    { key: "toDate", header: "To", render: c => <span className="nowrap">{formatDate(c.toDate)}</span> },
    { key: "days", header: "Days", align: "right", render: c => <span className="num">{daysInclusive(c.fromDate, c.toDate)}</span> },
    { key: "reason", header: "Reason" },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 52,
      render: c =>
        canEdit && (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(c)} aria-label={`Remove the closure “${c.reason}”`} title="Remove" />
          </div>
        )
    }
  ];

  return (
    <div className="stack">
      <LibraryIntro actions={addButton}>{HELP}</LibraryIntro>
      <Card flush>
        <div className="filter-bar">
          <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          columns={canEdit ? columns : columns.filter(c => c.key !== "actions")}
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={
            params.from || params.to ? (
              <EmptyState icon={<CalendarOff />} title="No closures in these dates" />
            ) : (
              <EmptyState
                icon={<CalendarOff />}
                title="No closures this year"
                message="Holidays and vacations come from the school calendar; add only the extra days the library is shut."
                actions={addButton}
              />
            )
          }
        />
      </Card>
      <AddClosureDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddClosureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ fromDate: "", toDate: "", reason: "" });
  const create = useApiMutation((body: { fromDate: string; toDate: string; reason: string }) => api.post<Closure>(PATH, body), { invalidate: [PATH] });
  const { values } = form;

  useEffect(() => {
    if (open) form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!values.fromDate) errs.fromDate = "Pick the first closed day";
    if (!values.toDate) errs.toDate = "Pick the last closed day";
    else if (values.fromDate && values.toDate < values.fromDate) errs.toDate = "must be on or after the first day";
    if (!values.reason.trim()) errs.reason = "Say why the library is closed";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    form.setFormError(null);
    create.mutate(
      { fromDate: values.fromDate, toDate: values.toDate, reason: values.reason.trim() },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  const days = values.fromDate && values.toDate && values.toDate >= values.fromDate ? daysInclusive(values.fromDate, values.toDate) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a closure"
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="closure-form" variant="primary" loading={create.isPending}>
            Add closure
          </Button>
        </>
      }
    >
      <form id="closure-form" className="stack" onSubmit={submit} noValidate>
        <p className="small muted">{HELP}</p>
        <div className="form-grid">
          <TextInput
            label="First closed day"
            type="date"
            required
            autoFocus
            {...form.text("fromDate")}
            onChange={e => {
              form.set("fromDate", e.target.value);
              if (!values.toDate) form.set("toDate", e.target.value);
            }}
          />
          <TextInput
            label="Last closed day"
            type="date"
            required
            min={values.fromDate || undefined}
            {...form.text("toDate")}
            hint={days ? plural(days, "day") : "Within a year of the first day"}
          />
        </div>
        <Textarea label="Reason" required rows={2} maxLength={200} placeholder="e.g. Renovation week" {...form.text("reason")} />
      </form>
    </Dialog>
  );
}
