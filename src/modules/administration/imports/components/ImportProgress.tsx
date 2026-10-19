import { useMemo, useState } from "react";
import { Download, GraduationCap } from "lucide-react";
import { saveBlob } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Alert, Button, ButtonLink, Card, DataTable, Kpi, Pagination, Spinner } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import type { ImportView, RowError } from "../api/imports";

/* Step "Importing" (QUEUED / PROCESSING): the page polls every 3 s */
export function ImportingStep({ job }: { job: ImportView }) {
  const pct = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
  return (
    <Card title={job.status === "QUEUED" ? "Waiting to start" : "Importing"}>
      <div className="stack">
        <div className="row-between">
          <span className="row">
            <Spinner /> {job.processedRows} of {job.totalRows} row(s) processed
          </span>
          <strong>{pct}%</strong>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="kpis">
          <Kpi label="Imported" value={job.succeeded} />
          <Kpi label="Failed" value={job.failed} />
          <Kpi label="Rows in file" value={job.totalRows} />
        </div>
        <div className="small muted">You can leave this page; we will notify you when the import finishes.</div>
      </div>
    </Card>
  );
}

const PAGE = 50;

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadErrors(job: ImportView) {
  const lines = ["row,message", ...job.rowErrors.map(e => `${csvCell(e.row)},${csvCell(e.message)}`)];
  const base = job.fileName.replace(/\.csv$/i, "");
  saveBlob(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }), `${base}-errors.csv`);
}

/* Step "Done" (COMPLETED / FAILED) */
export function DoneStep({ job }: { job: ImportView }) {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const errors = job.rowErrors ?? [];
  const rows = useMemo<RowError[]>(() => errors.slice((page - 1) * PAGE, page * PAGE), [errors, page]);
  /* Only the first 1000 row errors are kept */
  const unlisted = job.failed - errors.length;

  return (
    <div className="stack">
      {job.status === "FAILED" ? (
        <Alert tone="danger" title="The import stopped">
          {job.failureReason ?? "The file could not be processed."} Rows imported before it stopped are kept.
        </Alert>
      ) : (
        <Alert tone={job.failed ? "warning" : "success"} title="Import finished">
          {job.succeeded} student(s) admitted
          {job.failed ? `; ${job.failed} row(s) were skipped. Fix them in the file and import those rows again.` : "."}
          {job.finishedAt && <span className="muted"> Finished {formatDateTime(job.finishedAt)}.</span>}
        </Alert>
      )}
      <div className="kpis">
        <Kpi label="Imported" value={job.succeeded} />
        <Kpi label="Failed" value={job.failed} />
        <Kpi label="Rows in file" value={job.totalRows} />
      </div>
      {errors.length > 0 && (
        <Card
          flush
          title="Rows with problems"
          subtitle={unlisted > 0 ? `The first ${errors.length} are listed` : undefined}
          actions={
            <Button size="sm" icon={<Download />} onClick={() => downloadErrors(job)}>
              Download as CSV
            </Button>
          }
        >
          <DataTable
            columns={[
              { key: "row", header: "Row", width: 80 },
              { key: "message", header: "Problem" }
            ]}
            rows={rows}
            rowKey={e => String(e.row)}
          />
          {errors.length > PAGE && (
            <Pagination
              meta={{ page, limit: PAGE, total: errors.length, totalPages: Math.ceil(errors.length / PAGE) }}
              onPageChange={setPage}
            />
          )}
        </Card>
      )}
      {can("users.students.read") && job.succeeded > 0 && (
        <div className="form-actions">
          <ButtonLink to="/users/students" variant="primary" icon={<GraduationCap />}>
            Open students
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
