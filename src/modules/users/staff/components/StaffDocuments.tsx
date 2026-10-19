import { useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation } from "@/common/hooks";
import { Alert, Badge, Button, Card, DataTable, Dialog, EmptyState, FileDrop, Select, TextInput, useConfirm, useToast } from "@/common/ui";
import { enumLabel, formatBytes, formatDate } from "@/common/utils/format";
import { CATEGORY_RULES, deleteFile, fileDownloadUrl, uploadStaffFile, type StoredFile } from "../api/documents";

/* Documents filed on a staff record (contracts, certificates, a photo) */
export function StaffDocuments({ staffId, personName }: { staffId: string; personName: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useApiList<StoredFile>("/files", { ownerType: "STAFF", ownerId: staffId, page, limit: 20 });
  const remove = useApiMutation(deleteFile, { invalidate: ["/files"] });

  const download = async (f: StoredFile) => {
    setBusyId(f.id);
    /* Opened before the await so popup blockers treat it as the click's window */
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const res = await fileDownloadUrl(f.id);
      if (tab) tab.location.href = res.data.url;
      else window.open(res.data.url, "_blank", "noopener");
    } catch (e) {
      tab?.close();
      toast.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (f: StoredFile) => {
    const ok = await confirm({
      title: `Delete ${f.fileName}?`,
      message: `It is removed from ${personName}'s record for good.`,
      confirmLabel: "Delete"
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(f.id);
      toast.success(res.message || `${f.fileName} deleted`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Card
      flush
      title="Documents"
      actions={
        can("files.documents.upload") && (
          <Button size="sm" icon={<Upload />} onClick={() => setUploading(true)}>
            Upload
          </Button>
        )
      }
    >
      <DataTable
        rows={list.rows}
        rowKey={f => f.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        columns={[
          {
            key: "fileName",
            header: "File",
            render: f => (
              <div>
                <div style={{ fontWeight: 550 }}>{f.fileName}</div>
                {f.description && <div className="small muted">{f.description}</div>}
              </div>
            )
          },
          { key: "category", header: "Kind", render: f => <Badge>{enumLabel(f.category)}</Badge> },
          { key: "size", header: "Size", align: "right", render: f => formatBytes(f.size) },
          { key: "createdAt", header: "Uploaded", render: f => formatDate(f.createdAt) },
          {
            key: "actions",
            header: "",
            align: "right",
            render: f => (
              <span className="row" style={{ justifyContent: "flex-end" }}>
                <Button size="sm" variant="ghost" icon={<Download />} loading={busyId === f.id} onClick={() => void download(f)} aria-label={`Download ${f.fileName}`} />
                {can("files.documents.remove") && (
                  <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void onDelete(f)} aria-label={`Delete ${f.fileName}`} />
                )}
              </span>
            )
          }
        ]}
        empty={<EmptyState icon={<FileText />} title="No documents yet" />}
      />
      {uploading && <UploadDialog staffId={staffId} onClose={() => setUploading(false)} />}
    </Card>
  );
}

function UploadDialog({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState<keyof typeof CATEGORY_RULES>("DOCUMENT");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const upload = useApiMutation(() => uploadStaffFile(staffId, { file: file!, category, description }), { invalidate: ["/files"] });
  const rule = CATEGORY_RULES[category];

  const submit = async () => {
    if (!file) return setError("Choose a file to upload.");
    try {
      const res = await upload.mutateAsync(undefined);
      toast.success(res.message);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Upload a document"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={upload.isPending} disabled={!file} onClick={() => void submit()}>
            Upload
          </Button>
        </>
      }
    >
      <div className="stack">
        {error && <Alert tone="danger">{error}</Alert>}
        <Select
          label="Kind"
          value={category}
          onChange={e => {
            setCategory(e.target.value as keyof typeof CATEGORY_RULES);
            setFile(null);
            setError(null);
          }}
          options={[
            { value: "DOCUMENT", label: "Document" },
            { value: "PHOTO", label: "Photo" }
          ]}
        />
        <FileDrop
          accept={rule.accept}
          maxBytes={rule.maxBytes}
          hint={rule.hint}
          file={file}
          onFile={f => {
            setFile(f);
            setError(null);
          }}
          onReject={setError}
        />
        <TextInput label="Description" maxLength={300} placeholder="e.g. Signed contract 2026" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
    </Dialog>
  );
}
