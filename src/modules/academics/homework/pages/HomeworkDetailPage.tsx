/* AC-16 · Homework detail: drill-in header (title, Details / Submissions). Details: the facts,
   instructions and attachments; Submissions: every student of the section, by status, with
   the review drawer to grade or return. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, FileText, Pencil, Paperclip, Trash2, Upload } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Dialog,
  EmptyState,
  ErrorState,
  FileDrop,
  Page,
  SkeletonBlock,
  Tabs,
  useConfirm,
  useTabParam,
  useToast,
  type TabItem
} from "@/common/ui";
import { formatBytes, formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import {
  ATTACHMENT_RULE,
  attachmentUrl,
  deleteHomework,
  HOMEWORK_PATH,
  homeworkPath,
  openSigned,
  removeAttachment,
  SUBMISSION_LABELS,
  uploadAttachment,
  type Homework,
  type StoredFile,
  type SubmissionStatus,
  type Submissions
} from "../api/homework";
import { HomeworkDrawer } from "../components/HomeworkDrawer";
import { SubmissionBadge, SubmissionDrawer } from "../components/SubmissionDrawer";

export default function HomeworkDetailPage() {
  const { homeworkId = "" } = useParams();
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const q = useApiGet<Homework>(homeworkPath(homeworkId));
  const tabs: TabItem[] = [
    { id: "details", label: "Details" },
    { id: "submissions", label: "Submissions" }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const h = q.data;
  const header = <DrillHeader back={HOMEWORK_PATH} backLabel="Back to homework" title={h?.title ?? "Homework"} tabs={tabs} value={tab} onChange={setTab} />;
  const canManage = can("academics.homework.manage") && !readOnly;

  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      {!h ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : tab === "details" ? (
        <Details homework={h} canManage={canManage} />
      ) : (
        <SubmissionsTab homework={h} canGrade={can("academics.homework.grade") && !readOnly} />
      )}
    </Page>
  );
}

function Details({ homework: h, canManage }: { homework: Homework; canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const sections = useSectionOptions();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const remove = useApiMutation(deleteHomework, { invalidate: [HOMEWORK_PATH] });
  const removeFile = useApiMutation(removeAttachment, { invalidate: [HOMEWORK_PATH] });
  const section = sections.byId.get(h.sectionId);
  const files = h.attachments ?? [];

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete “${h.title}”?`,
      message: `It is removed for ${section ? sectionTitle(section) : "the section"}. Homework that students have already handed in can't be deleted.`,
      confirmLabel: "Delete homework"
    });
    if (!ok) return;
    remove.mutate(h.id, {
      onSuccess: res => {
        toast.success(res.message || "Homework deleted");
        navigate(HOMEWORK_PATH);
      },
      onError: e => toast.error(e)
    });
  };

  const download = async (f: StoredFile) => {
    setBusyFile(f.id);
    try {
      await openSigned(() => attachmentUrl(h.id, f.id));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusyFile(null);
    }
  };

  const askRemoveFile = async (f: StoredFile) => {
    const ok = await confirm({ title: `Remove ${f.fileName}?`, message: `Students no longer see it on “${h.title}”.`, confirmLabel: "Remove" });
    if (!ok) return;
    removeFile.mutate({ id: h.id, fileId: f.id }, { onSuccess: res => toast.success(res.message || `${f.fileName} removed`), onError: e => toast.error(e) });
  };

  const due = h.dueDate < todayIso() ? <Badge>Past due</Badge> : null;
  return (
    <div className="stack">
      <Card
        title={h.title}
        subtitle={`${section ? sectionTitle(section) : ""}${h.subject ? ` · ${h.subject.subjectName}` : ""}`}
        actions={
          canManage && (
            <>
              <Button size="sm" icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askDelete()} loading={remove.isPending}>
                Delete
              </Button>
            </>
          )
        }
      >
        <DescriptionList
          columns={3}
          items={[
            { label: "Set on", value: formatDate(h.assignedOn) },
            {
              label: "Due",
              value: (
                <span className="row" style={{ gap: 6 }}>
                  {formatDate(h.dueDate)} {due}
                </span>
              )
            },
            { label: "Marks", value: h.maxMarks === null ? "Feedback only" : `Out of ${h.maxMarks}` },
            { label: "Late submissions", value: h.allowLateSubmission ? "Accepted" : "Not accepted" },
            { label: "Last changed", value: formatDateTime(h.updatedAt) },
            { label: "Instructions", value: h.description ? <span style={{ whiteSpace: "pre-wrap" }}>{h.description}</span> : null, wide: true }
          ]}
        />
      </Card>
      <Card
        flush
        title="Attachments"
        subtitle={`${files.length} file${files.length === 1 ? "" : "s"} students can open`}
        actions={
          canManage && (
            <Button size="sm" icon={<Upload />} onClick={() => setUploading(true)}>
              Attach a file
            </Button>
          )
        }
      >
        <DataTable
          rows={files}
          rowKey={f => f.id}
          columns={[
            {
              key: "fileName",
              header: "File",
              render: f => (
                <span className="row" style={{ gap: 8 }}>
                  <FileText size={16} />
                  <strong>{f.fileName}</strong>
                </span>
              )
            },
            { key: "size", header: "Size", align: "right", render: f => formatBytes(f.size) },
            { key: "createdAt", header: "Added", render: f => formatDate(f.createdAt) },
            {
              key: "actions",
              header: "",
              align: "right",
              render: f => (
                <span className="row" style={{ justifyContent: "flex-end" }}>
                  <Button size="sm" variant="ghost" icon={<Download />} loading={busyFile === f.id} onClick={() => void download(f)} aria-label={`Download ${f.fileName}`} title="Download" />
                  {canManage && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemoveFile(f)} aria-label={`Remove ${f.fileName}`} title="Remove" />}
                </span>
              )
            }
          ]}
          empty={<EmptyState icon={<Paperclip />} title="No attachments" message={canManage ? "Attach a worksheet, a reading or an example." : undefined} />}
        />
      </Card>
      <HomeworkDrawer open={editing} homework={h} onClose={() => setEditing(false)} />
      {uploading && <UploadDialog homeworkId={h.id} onClose={() => setUploading(false)} />}
    </div>
  );
}

function UploadDialog({ homeworkId, onClose }: { homeworkId: string; onClose: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useApiMutation(uploadAttachment, { invalidate: [HOMEWORK_PATH] });
  const submit = () => {
    if (!file) return setError("Choose a file to attach.");
    upload.mutate(
      { id: homeworkId, file },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: e => setError(errorMessage(e))
      }
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Attach a file"
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={upload.isPending} disabled={!file} onClick={submit}>
            Attach
          </Button>
        </>
      }
    >
      <FileDrop
        accept={ATTACHMENT_RULE.accept}
        maxBytes={ATTACHMENT_RULE.maxBytes}
        hint={ATTACHMENT_RULE.hint}
        file={file}
        onFile={f => {
          setFile(f);
          setError(null);
        }}
        onReject={setError}
      />
    </Dialog>
  );
}

const FILTERS: (SubmissionStatus | "ALL")[] = ["ALL", "SUBMITTED", "LATE", "GRADED", "RETURNED", "NOT_SUBMITTED"];

function SubmissionsTab({ homework: h, canGrade }: { homework: Homework; canGrade: boolean }) {
  const q = useApiGet<Submissions>(`${homeworkPath(h.id)}/submissions`);
  const [filter, setFilter] = useState<string>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const students = q.data?.students ?? [];
  const count = (f: string) => (f === "ALL" ? students.length : students.filter(s => s.status === f).length);
  const rows = q.data ? students.filter(s => filter === "ALL" || s.status === filter) : undefined;
  const open = students.find(s => s.studentId === openId) ?? null;
  const name = (s: { firstName?: string; lastName?: string }) => [s.firstName, s.lastName].filter(Boolean).join(" ") || "Student";

  return (
    <Card flush>
      <Tabs
        tabs={FILTERS.map(f => ({ id: f, label: f === "ALL" ? "All" : SUBMISSION_LABELS[f], count: q.data ? count(f) : undefined }))}
        value={filter}
        onChange={setFilter}
      />
      <DataTable
        rows={rows}
        rowKey={s => s.studentId}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        onRowClick={s => setOpenId(s.studentId)}
        columns={[
          { key: "rollNumber", header: "Roll", width: 90, render: s => <span className="mono">{s.rollNumber ?? "—"}</span> },
          { key: "name", header: "Student", render: s => <strong>{name(s)}</strong> },
          { key: "status", header: "Status", render: s => <SubmissionBadge status={s.status} /> },
          { key: "submittedAt", header: "Handed in", render: s => (s.submission ? <span className="nowrap">{formatDateTime(s.submission.submittedAt)}</span> : <span className="muted">—</span>) },
          {
            key: "marks",
            header: "Marks",
            align: "right",
            render: s => (h.maxMarks === null ? <span className="muted">—</span> : s.submission?.marksAwarded !== null && s.submission?.marksAwarded !== undefined ? `${s.submission.marksAwarded} / ${h.maxMarks}` : <span className="muted">—</span>)
          },
          { key: "feedback", header: "Feedback", render: s => <span className="small muted">{s.submission?.feedback ?? ""}</span> }
        ]}
        empty={<EmptyState title={filter === "ALL" ? "No students in this section" : `Nobody is ${SUBMISSION_LABELS[filter as SubmissionStatus].toLowerCase()}`} />}
      />
      {open && <SubmissionDrawer homeworkId={h.id} maxMarks={h.maxMarks} student={open} canGrade={canGrade} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
