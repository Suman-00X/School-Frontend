import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileUp } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, Select, StatusBadge, useToast, type Column } from "@/common/ui";
import { enumOptions, formatDateTime, relativeTime } from "@/common/utils/format";
import { IMPORT_STATUSES, downloadTemplate, useImports, type ImportJob } from "../api/imports";
import { UploadDialog } from "../components/UploadDialog";
import { PageIntro } from "../../shared/components/PageIntro";

/* AD-02 */
export default function ImportsListPage() {
  const { can } = useAuth();
  const canCreate = can("administration.imports.create");
  const toast = useToast();
  const navigate = useNavigate();
  const { params, setParam, setPage } = useListParams({ status: "" });
  const list = useImports(params);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const template = async () => {
    setDownloading(true);
    try {
      await downloadTemplate();
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const columns: Column<ImportJob>[] = [
    {
      key: "fileName",
      header: "File",
      render: j => (
        <div>
          <div style={{ fontWeight: 550 }}>{j.fileName}</div>
          <div className="small muted">Students</div>
        </div>
      )
    },
    { key: "status", header: "Status", render: j => <StatusBadge status={j.status} /> },
    {
      key: "rows",
      header: "Rows",
      render: j =>
        j.status === "MAPPING" || j.status === "CANCELLED" || j.status === "QUEUED" ? (
          <span>{j.totalRows} in file</span>
        ) : (
          <span className="nowrap">
            <span style={{ color: "var(--success-text)" }}>{j.succeeded} imported</span>
            {" · "}
            <span style={{ color: j.failed ? "var(--danger-text)" : undefined }}>{j.failed} failed</span>
            {" · "}
            {j.totalRows} total
          </span>
        )
    },
    {
      key: "createdAt",
      header: "Uploaded",
      render: j => <span title={formatDateTime(j.createdAt)}>{relativeTime(j.createdAt)}</span>
    },
    {
      key: "finishedAt",
      header: "Finished",
      render: j => (j.finishedAt ? formatDateTime(j.finishedAt) : <span className="muted">—</span>)
    }
  ];

  return (
    <Page>
      {/* The header tab already says "Imports": no title, just what it is for */}
      <PageIntro
        actions={
          canCreate && (
            <>
              <Button icon={<Download />} loading={downloading} onClick={() => void template()}>
                Download template
              </Button>
              <Button variant="primary" icon={<FileUp />} onClick={() => setUploading(true)}>
                Import students
              </Button>
            </>
          )
        }
      >
        Admit many students at once from a CSV file.
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Status"
            className="select-sm"
            value={params.status}
            onChange={e => setParam("status", e.target.value)}
            placeholder="Any status"
            options={enumOptions(IMPORT_STATUSES)}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={j => j.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={j => navigate(`/administration/imports/${j.id}`)}
          empty={
            <EmptyState
              icon={<FileUp />}
              title={params.status ? "No imports with this status." : "No imports yet"}
              message={params.status ? undefined : "Download the template, fill it in, then import it."}
              actions={
                canCreate &&
                !params.status && (
                  <Button variant="primary" onClick={() => setUploading(true)}>
                    Import students
                  </Button>
                )
              }
            />
          }
        />
      </Card>
      {canCreate && <UploadDialog open={uploading} onClose={() => setUploading(false)} />}
    </Page>
  );
}
