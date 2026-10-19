import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Info, Play, XCircle } from "lucide-react";
import { isApiError } from "@/common/api";
import { Alert, Badge, Button, Card, DataTable, useConfirm, useToast } from "@/common/ui";
import { useCancelImport, useStartImport, useUpdateMapping, type ImportView, type MappingColumn } from "../api/imports";

const NOT_IN_FILE = "";

/* Step "Match columns" (status MAPPING): field → column selects, ignored columns, dry-run preview */
export function MappingStep({ job, canEdit, onStale }: { job: ImportView; canEdit: boolean; onStale: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const update = useUpdateMapping(job.id);
  const start = useStartImport(job.id);
  const cancel = useCancelImport(job.id);

  const fields = job.fields ?? [];
  const columns = job.columns as MappingColumn[];
  const missing = fields.filter(f => job.missingRequired?.includes(f.field));
  /* The API's summary of the last change ("6 of 15 fields matched…") */
  const [summary, setSummary] = useState<string | null>(null);
  const busy = update.isPending || start.isPending || cancel.isPending;

  /* 409: someone started or cancelled it meanwhile */
  const onError = (e: unknown) => {
    toast.error(e);
    if (isApiError(e) && e.status === 409) onStale();
  };

  const choose = (field: string, column: string) => {
    const changes: Record<string, string | null> = { [field]: column || null };
    /* One column feeds one field: taking it from another field unmaps that one */
    if (column) for (const f of fields) if (f.field !== field && f.column === column) changes[f.field] = null;
    update.mutate(changes, { onSuccess: res => setSummary(res.message), onError });
  };

  const startImport = () =>
    start.mutate(undefined, {
      onSuccess: res => toast.success(res.message),
      onError
    });

  const cancelImport = async () => {
    const ok = await confirm({
      title: "Cancel this import?",
      message: `${job.fileName} will not be imported. You can upload it again later.`,
      confirmLabel: "Cancel import"
    });
    if (!ok) return;
    cancel.mutate(undefined, {
      onSuccess: res => {
        toast.success(res.message);
        navigate("/administration/imports");
      },
      onError
    });
  };

  const ignored = columns.filter(c => !c.mapped);
  const samplesOf = (header: string | null) => columns.find(c => c.header === header)?.samples.filter(Boolean) ?? [];
  const okRows = job.preview?.filter(p => p.ok).length ?? 0;

  return (
    <div className="stack">
      {missing.length > 0 && (
        <Alert tone="warning" title="Some required fields have no column">
          Pick a column for: {missing.map(f => f.label).join(", ")}.
        </Alert>
      )}

      <Card
        title="Match columns"
        subtitle={`${job.totalRows} row(s) in ${job.fileName}. Pick the column of the file that holds each field.`}
      >
        <div className="stack">
          {summary && (
            <div className="small muted" role="status">
              {summary}
            </div>
          )}
          {fields.map(f => (
            <div key={f.field} className="import-map-row">
              <div>
                <div style={{ fontWeight: 550 }}>
                  {f.label} {f.required && <Badge tone="warning">Required</Badge>}
                </div>
                <div className="small muted mono">{f.field}</div>
              </div>
              <div>
                <select
                  className="select"
                  aria-label={`Column for ${f.label}`}
                  value={f.column ?? NOT_IN_FILE}
                  disabled={!canEdit || busy}
                  onChange={e => choose(f.field, e.target.value)}
                >
                  <option value={NOT_IN_FILE}>Not in file</option>
                  {columns.map(c => (
                    <option key={c.header} value={c.header}>
                      {c.header}
                    </option>
                  ))}
                </select>
                {f.column && samplesOf(f.column).length > 0 && (
                  <div className="small muted" style={{ marginTop: 4 }}>
                    e.g. {samplesOf(f.column).slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
          {ignored.length > 0 && (
            <div>
              <div className="section-title" style={{ marginBottom: 6 }}>
                Ignored columns
              </div>
              <div className="row">
                {ignored.map(c => (
                  <Badge key={c.header}>{c.header}</Badge>
                ))}
              </div>
            </div>
          )}
          <Alert tone="info" title="How parents are matched">
            A parent email that already belongs to a parent links that parent (for siblings). An email that belongs to an
            account that is not a parent fails that row.
          </Alert>
        </div>
      </Card>

      <Card
        flush
        title="Preview"
        subtitle={`${okRows} of ${job.preview?.length ?? 0} checked rows look fine`}
      >
        <div className="row small muted" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <Info size={14} />
          This checks the first 20 rows only. Rows with problems are skipped during the import and listed afterwards.
        </div>
        <DataTable
          columns={[
            { key: "row", header: "Row", width: 80 },
            {
              key: "ok",
              header: "Check",
              render: p =>
                p.ok ? (
                  <span className="row" style={{ color: "var(--success-text)" }}>
                    <CheckCircle2 size={15} /> OK
                  </span>
                ) : (
                  <span className="row" style={{ color: "var(--danger-text)", alignItems: "flex-start", flexWrap: "nowrap" }}>
                    <XCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> {p.message}
                  </span>
                )
            }
          ]}
          rows={job.preview ?? []}
          rowKey={p => String(p.row)}
          loading={update.isPending}
        />
      </Card>

      {canEdit && (
        <div className="form-actions">
          <Button onClick={() => void cancelImport()} disabled={busy} loading={cancel.isPending}>
            Cancel import
          </Button>
          <Button
            variant="primary"
            icon={<Play />}
            onClick={startImport}
            disabled={busy || missing.length > 0}
            loading={start.isPending}
            title={missing.length ? "Map every required field first" : undefined}
          >
            Start import
          </Button>
        </div>
      )}
    </div>
  );
}
