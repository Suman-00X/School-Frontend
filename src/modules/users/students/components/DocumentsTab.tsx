import { useMemo, useState, type FormEvent } from "react";
import { Download, FileImage, FileText, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Alert, Button, Card, DataTable, Drawer, EmptyState, FileDrop, Select, TextInput, useConfirm, useToast, type Column } from "@/common/ui";
import { formatBytes, formatDateTime } from "@/common/utils/format";
import { FILE_RULES, deleteFile, getDownloadLink, uploadStudentFile, useStudentFiles, type FileCategory, type StoredFile } from "../api/records";
import type { Student } from "../api/students";

const CATEGORIES = [
  { value: "PHOTO", label: "Photo" },
  { value: "DOCUMENT", label: "Document" }
];

/* FL-01 embedded with ownerType=STUDENT and the student's id fixed */
export function DocumentsTab({ student }: { student: Student }) {
  const { can, me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const files = useStudentFiles(student.id);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const remove = useApiMutation((f: StoredFile) => deleteFile(f.id), { invalidate: ["/files"] });

  /* The API ignores ?category= (gap), so the filter runs here */
  const rows = useMemo(() => (files.data ?? []).filter(f => !category || f.category === category), [files.data, category]);

  const download = async (f: StoredFile) => {
    /* Open the tab first so the browser doesn't block it as a pop-up; the link expires, so never cache it */
    const tab = window.open("", "_blank");
    try {
      const link = await getDownloadLink(f.id);
      if (tab) {
        tab.opener = null;
        tab.location.href = link.url;
      }
      else window.location.assign(link.url);
    } catch (e) {
      tab?.close();
      toast.error(e);
    }
  };

  const onDelete = async (f: StoredFile) => {
    const ok = await confirm({ title: "Delete file", message: `Delete ${f.fileName}? This cannot be undone.`, confirmLabel: "Delete" });
    if (ok) remove.mutate(f, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const columns: Column<StoredFile>[] = [
    {
      key: "fileName",
      header: "File",
      render: f => (
        <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          {f.contentType.startsWith("image/") ? <FileImage size={16} className="muted" /> : <FileText size={16} className="muted" />}
          {f.fileName}
        </span>
      )
    },
    { key: "category", header: "Category", render: f => (f.category === "PHOTO" ? "Photo" : "Document") },
    { key: "description", header: "Description", render: f => f.description || <span className="muted">—</span> },
    { key: "size", header: "Size", align: "right", render: f => formatBytes(f.size) },
    {
      key: "createdAt",
      header: "Uploaded",
      render: f => (
        <span className="nowrap">
          {formatDateTime(f.createdAt)}
          {/* uploadedBy is only an id (gap): name it when it's the viewer */}
          {f.uploadedBy === me?.account.id && <span className="muted"> · you</span>}
        </span>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: f => (
        <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Button size="sm" variant="ghost" icon={<Download />} onClick={() => void download(f)}>
            Download
          </Button>
          {can("files.documents.remove") && (
            <Button size="sm" variant="ghost" icon={<Trash2 />} aria-label={`Delete ${f.fileName}`} onClick={() => void onDelete(f)} />
          )}
        </div>
      )
    }
  ];

  return (
    <Card
      flush
      title="Documents"
      actions={
        <>
          <Select className="select-sm" aria-label="Category" value={category} placeholder="All categories" options={CATEGORIES} onChange={e => setCategory(e.target.value)} />
          {can("files.documents.upload") && (
            <Button size="sm" variant="primary" icon={<Upload />} onClick={() => setUploading(true)}>
              Upload
            </Button>
          )}
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={files.data ? rows : undefined}
        rowKey={f => f.id}
        loading={files.isLoading}
        error={files.error}
        onRetry={() => void files.refetch()}
        empty={<EmptyState icon={<FileText />} title={category ? "No files in this category." : "No documents yet."} />}
      />
      {uploading && <UploadDrawer student={student} onClose={() => setUploading(false)} />}
    </Card>
  );
}

function UploadDrawer({ student, onClose }: { student: Student; onClose: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState<FileCategory>("DOCUMENT");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useApiMutation(uploadStudentFile, { invalidate: ["/files"] });
  const rule = FILE_RULES[category];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Choose a file to upload.");
    setError(null);
    upload.mutate(
      { studentId: student.id, file, category, description },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        /* 400 wrong type, too large or content mismatch; 413 over the upload limit */
        onError: e => setError(e instanceof Error ? e.message : "Upload failed.")
      }
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Upload a document"
      footer={
        <>
          <Button onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="upload-file" variant="primary" loading={upload.isPending}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-file" className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Select
          label="Category"
          required
          options={CATEGORIES}
          value={category}
          onChange={e => {
            setCategory(e.target.value as FileCategory);
            setFile(null);
          }}
          hint={category === "PHOTO" ? "The newest photo is shown on the profile." : undefined}
        />
        <TextInput label="Description" maxLength={300} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Birth certificate" />
        <FileDrop accept={rule.accept} maxBytes={rule.maxBytes} hint={rule.hint} file={file} onFile={setFile} onReject={setError} />
      </form>
    </Drawer>
  );
}
