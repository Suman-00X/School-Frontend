import { useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, Select, Tabs, useConfirm, useToast, type Column } from "@/common/ui";
import { formatBytes, formatDate, formatDateTime } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { PageIntro } from "../../shared/components/PageIntro";
import { deleteFile, FILE_RULES, FILES_PATH, OWNER_LABELS, OWNER_TYPES, useStaffRecords, type OwnerType, type StoredFile } from "../api/documents";
import { FileDrawer } from "../components/FileDrawer";
import { FileTypeIcon, useDownload, useFileNames } from "../components/fileParts";
import { UploadDrawer } from "../components/UploadDrawer";
import "../components/files.css";

/* FL-01 · Documents: files filed on student and staff records and the school's own documents.
   Downloads go through a signed link valid for 15 minutes. */
export default function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParams, setPage } = useListParams({ ownerType: "STUDENT", ownerId: "" });
  const ownerType = (OWNER_TYPES as readonly string[]).includes(params.ownerType) ? (params.ownerType as OwnerType) : "STUDENT";
  const list = useApiList<StoredFile>(FILES_PATH, { ownerType, ownerId: ownerType === "GENERAL" ? undefined : params.ownerId || undefined, page: params.page, limit: params.limit });
  const names = useFileNames();
  const staff = useStaffRecords();
  const download = useDownload();
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const remove = useApiMutation(deleteFile, { invalidate: [FILES_PATH, "/files/activity"] });
  const canUpload = can("files.documents.upload");
  const canRemove = can("files.documents.remove");

  const askDelete = async (f: StoredFile) => {
    const owner = names.owner(f);
    const ok = await confirm({
      title: `Delete ${f.fileName}?`,
      message: `${owner && f.ownerType !== "GENERAL" ? `It is removed from ${owner}'s record. ` : ""}This cannot be undone.`,
      confirmLabel: "Delete"
    });
    if (!ok) return;
    remove.mutate(f.id, {
      onSuccess: res => {
        toast.success(res.message || `${f.fileName} deleted`);
        setOpenId(null);
      },
      onError: e => toast.error(e)
    });
  };

  const columns: Column<StoredFile>[] = [
    {
      key: "fileName",
      header: "File",
      render: f => (
        <div className="file-name-cell">
          <FileTypeIcon contentType={f.contentType} />
          <div style={{ minWidth: 0 }}>
            <div className="file-name" title={f.fileName}>
              {f.fileName}
            </div>
            {f.description && (
              <div className="file-desc small muted" title={f.description}>
                {f.description}
              </div>
            )}
          </div>
        </div>
      )
    },
    ...(ownerType === "GENERAL"
      ? []
      : [
          {
            key: "owner",
            header: ownerType === "STUDENT" ? "Student" : "Staff member",
            render: (f: StoredFile) => names.owner(f) ?? <span className="muted">—</span>
          }
        ]),
    { key: "category", header: "Kind", render: f => <Badge>{FILE_RULES[f.category]?.label ?? f.category}</Badge> },
    { key: "size", header: "Size", align: "right", render: f => <span className="nowrap">{formatBytes(f.size)}</span> },
    {
      key: "createdAt",
      header: "Uploaded",
      render: f => (
        <span className="nowrap" title={formatDateTime(f.createdAt)}>
          {formatDate(f.createdAt)}
          {names.uploader(f.uploadedBy) && <span className="muted"> · {names.uploader(f.uploadedBy)}</span>}
        </span>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: f => (
        <div className="row-actions" onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Download />}
            loading={downloading === f.id}
            onClick={async () => {
              setDownloading(f.id);
              await download(f);
              setDownloading(null);
            }}
            aria-label={`Download ${f.fileName}`}
            title="Download"
          />
          {canRemove && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askDelete(f)} aria-label={`Delete ${f.fileName}`} title="Delete" />}
        </div>
      )
    }
  ];

  const uploadButton = canUpload && (
    <Button variant="primary" icon={<Upload />} onClick={() => setUploading(true)}>
      Upload
    </Button>
  );

  const ownerFilter =
    ownerType === "STUDENT" ? (
      <StudentSelect label="Student" className="select-sm" value={params.ownerId} placeholder="All students" onChange={e => setParams({ ownerId: e.target.value })} />
    ) : ownerType === "STAFF" ? (
      <Select
        label="Staff member"
        className="select-sm"
        value={params.ownerId}
        options={staff.options}
        searchable
        disabled={!staff.allowed}
        placeholder={staff.allowed ? "All staff" : "All staff (you can't list staff)"}
        onChange={e => setParams({ ownerId: e.target.value })}
      />
    ) : (
      <Select label="Owner" className="select-sm" value="" options={[]} disabled placeholder="The whole school" />
    );

  return (
    <Page>
      <PageIntro actions={uploadButton}>Certificates, ID copies, photos and circulars, filed on student and staff records or for the whole school.</PageIntro>
      <Card flush>
        <div className="list-tabs">
          <Tabs tabs={OWNER_TYPES.map(t => ({ id: t, label: OWNER_LABELS[t].tab }))} value={ownerType} onChange={id => setParams({ ownerType: id, ownerId: "" })} />
        </div>
        <div className="filter-bar">
          <div className="filter-wide">{ownerFilter}</div>
        </div>
        <DataTable
          rows={list.rows}
          rowKey={f => f.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={f => setOpenId(f.id)}
          columns={columns}
          empty={
            params.ownerId ? (
              <EmptyState icon={<FileText />} title="No documents for this person yet" actions={uploadButton} />
            ) : (
              <EmptyState icon={<FileText />} title="No documents yet." actions={uploadButton} />
            )
          }
        />
      </Card>
      {openId && <FileDrawer id={openId} onClose={() => setOpenId(null)} onDelete={f => void askDelete(f)} />}
      {uploading && <UploadDrawer ownerType={ownerType} ownerId={ownerType === "GENERAL" ? undefined : params.ownerId || undefined} onClose={() => setUploading(false)} />}
    </Page>
  );
}
