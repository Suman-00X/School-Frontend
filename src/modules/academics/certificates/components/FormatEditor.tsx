import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { FileText, History, RotateCcw, Save } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useDebounce } from "@/common/hooks";
import { Alert, Badge, Button, Card, Dialog, Drawer, Select, Spinner, Tabs, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import {
  FORMATS_PATH,
  getFormatVersion,
  openPdf,
  previewFormat,
  previewFormatPdf,
  restoreFormat,
  saveFormat,
  FORMAT_ORDER,
  FORMAT_SHORT,
  useFormat,
  useFormatVersions,
  type FormatDraft,
  type FormatType,
  type FormatVersion
} from "../api/certificates";
import { CertificatePreview } from "./CertificatePreview";

/* The formats tab: each certificate's HTML and CSS, and the report card's, edited with a
   live preview. Saving makes a new version (the one new certificates and report cards
   use); certificates already issued keep the version they were issued with, and a
   published report card the version in use when it was published. Old versions can be
   opened or restored. */
export function FormatEditor() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useSearchParams();
  const raw = search.get("format") as FormatType | null;
  const type: FormatType = raw && FORMAT_ORDER.includes(raw) ? raw : "BONAFIDE";
  const [dirty, setDirty] = useState(false);

  const choose = async (next: string) => {
    if (next === type) return;
    if (dirty && !(await confirm({ title: "Discard your changes?", message: "The format you are editing has changes that aren't saved.", confirmLabel: "Discard" }))) return;
    setDirty(false);
    setSearch(prev => {
      const params = new URLSearchParams(prev);
      params.set("format", next);
      return params;
    }, { replace: true });
  };

  return (
    <div className="stack">
      <Tabs tabs={FORMAT_ORDER.map(t => ({ id: t, label: FORMAT_SHORT[t] }))} value={type} onChange={choose} />
      <TypeEditor key={type} type={type} canManage={can("academics.certificateFormats.manage")} onDirty={setDirty} />
    </div>
  );
}

function TypeEditor({ type, canManage, onDirty }: { type: FormatType; canManage: boolean; onDirty: (dirty: boolean) => void }) {
  const toast = useToast();
  const format = useFormat(type);
  const [draft, setDraft] = useState<FormatDraft | null>(null);
  /* The saved version the draft started from (a newer save by someone else is a conflict) */
  const [base, setBase] = useState<FormatVersion | null>(null);
  /* Opened from the history: an older version loaded into the editor */
  const [openedFrom, setOpenedFrom] = useState<number | null>(null);
  const [part, setPart] = useState<"html" | "css">("html");
  const [studentId, setStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  const load = (version: FormatVersion) => {
    setDraft({ name: version.name, html: version.html ?? "", css: version.css ?? "" });
    setBase(version);
    setOpenedFrom(null);
  };

  /* First load, and after a save: the editor shows the version in use */
  useEffect(() => {
    if (format.data && (!base || format.data.version > base.version) && !isDirty()) load(format.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format.data]);

  const isDirty = () => !!draft && !!base && (draft.html !== base.html || draft.css !== base.css || draft.name !== base.name);
  const dirty = isDirty();
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  /* Ask before leaving the page with unsaved changes */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const debounced = useDebounce(draft, 500);
  const preview = useQuery({
    queryKey: [`${FORMATS_PATH}/${type}/preview`, debounced, studentId],
    enabled: !!debounced?.html.trim(),
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async ({ signal }) => (await previewFormat(type, { ...debounced!, ...(studentId && { studentId }) }, signal)).data.html
  });

  /* While the format has an error, keep showing the last good render */
  const lastGood = useRef<string | null>(null);
  if (preview.data && !preview.error) lastGood.current = preview.data;

  /* The text each field inserts: a list's field is {{field}}, used inside {{#each list}} */
  const insertText = useMemo(
    () => new Map((format.data?.placeholders ?? []).flatMap(group => group.fields.map(f => [f.key, f.insert ?? `{{${f.key}}}`] as const))),
    [format.data?.placeholders]
  );
  const fields = useMemo(
    () =>
      (format.data?.placeholders ?? []).flatMap(group =>
        group.fields.map(f => ({
          value: f.key,
          label: `${group.group}: ${f.label}`,
          description: `${insertText.get(f.key)!.split("\n")[0]}${f.sample ? ` · ${f.sample}` : ""}`
        }))
      ),
    [format.data?.placeholders, insertText]
  );

  const edit = (changes: Partial<FormatDraft>) => setDraft(prev => (prev ? { ...prev, ...changes } : prev));

  /* Put text at the cursor of the open editor (HTML or CSS) and keep typing after it */
  const insert = (text: string) => {
    const el = editor.current;
    if (!el || !draft) return;
    const value = draft[part];
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    edit({ [part]: value.slice(0, start) + text + value.slice(end) });
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && canManage) {
      e.preventDefault();
      insert("  ");
    }
  };

  const showPdf = async () => {
    if (!draft) return;
    setPdfBusy(true);
    try {
      await openPdf(() => previewFormatPdf(type, { ...draft, ...(studentId && { studentId }) }));
    } catch (error) {
      toast.error(error);
    } finally {
      setPdfBusy(false);
    }
  };

  const openVersion = async (version: number) => {
    try {
      const old = (await getFormatVersion(type, version)).data;
      setDraft({ name: old.name, html: old.html ?? "", css: old.css ?? "" });
      setOpenedFrom(version);
      setHistory(false);
    } catch (error) {
      toast.error(error);
    }
  };

  if (format.error) return <Alert tone="danger">{errorMessage(format.error)}</Alert>;
  if (format.isLoading || !draft || !base) return <Spinner />;

  const inUse = format.data!;
  const status = [
    `Version ${inUse.version} in use`,
    `saved ${formatDate(inUse.createdAt)}${inUse.createdByName ? ` by ${inUse.createdByName}` : ""}`
  ].join(" · ");

  return (
    <>
      <Card
        flush
        title={
          <span className="row" style={{ gap: 8 }}>
            {inUse.label ?? draft.name}
            {dirty ? <Badge tone="warning">Unsaved changes</Badge> : <Badge tone="success">Saved</Badge>}
            {openedFrom !== null && <Badge tone="info">Copy of version {openedFrom}</Badge>}
          </span>
        }
        subtitle={status}
        actions={
          <>
            <Button icon={<History />} onClick={() => setHistory(true)}>
              Versions
            </Button>
            <Button icon={<FileText />} loading={pdfBusy} onClick={showPdf}>
              Preview PDF
            </Button>
            {canManage && dirty && (
              <Button icon={<RotateCcw />} onClick={() => load(inUse)}>
                Discard
              </Button>
            )}
            {canManage && (
              <Button variant="primary" icon={<Save />} disabled={!dirty || !draft.html.trim()} onClick={() => setSaving(true)}>
                Save as version {inUse.version + 1}
              </Button>
            )}
          </>
        }
      >
        <div className="cert-editor">
          <div className="cert-editor-code">
            <div className="cert-editor-bar">
              <Tabs
                tabs={[
                  { id: "html", label: "HTML" },
                  { id: "css", label: "CSS" }
                ]}
                value={part}
                onChange={id => setPart(id as "html" | "css")}
              />
              {canManage && part === "html" && (
                <Select
                  className="select-sm"
                  aria-label="Insert a field"
                  placeholder="Insert a field…"
                  searchable
                  options={fields}
                  value=""
                  onChange={e => insertText.has(e.target.value) && insert(insertText.get(e.target.value)!)}
                />
              )}
            </div>
            <textarea
              ref={editor}
              className="cert-code"
              spellCheck={false}
              readOnly={!canManage}
              aria-label={part === "html" ? "HTML" : "CSS"}
              value={draft[part]}
              onChange={e => edit({ [part]: e.target.value })}
              onKeyDown={onKeyDown}
            />
            <p className="small muted cert-editor-help">
              Fields are written <code>{"{{student.name}}"}</code>; show a part only when a field has a value with{" "}
              <code>{"{{#if student.pen}}…{{else}}…{{/if}}"}</code>; repeat a part for each item of a list with{" "}
              <code>{"{{#each report.subjects}}{{name}}{{/each}}"}</code>. Images and fonts must be embedded (data: URLs) or use{" "}
              <code>{"{{school.logo}}"}</code>; nothing is loaded from the internet and scripts don't run.
            </p>
          </div>
          <div className="cert-editor-preview">
            <div className="cert-editor-bar">
              <StudentSelect label={undefined} value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Sample details" className="select-sm" />
            </div>
            <CertificatePreview
              html={preview.error ? lastGood.current : (preview.data ?? null)}
              loading={preview.isFetching}
              error={preview.error ? errorMessage(preview.error) : null}
              empty="Write the format to see it here."
            />
          </div>
        </div>
      </Card>

      <SaveDialog
        open={saving}
        onClose={() => setSaving(false)}
        type={type}
        draft={draft}
        base={base}
        openedFrom={openedFrom}
        onSaved={saved => {
          load(saved);
          setSaving(false);
        }}
      />
      <VersionsDrawer open={history} onClose={() => setHistory(false)} type={type} inUse={inUse.version} canManage={canManage} dirty={dirty} onOpen={openVersion} onRestored={load} />
    </>
  );
}

function SaveDialog({
  open,
  onClose,
  type,
  draft,
  base,
  openedFrom,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  type: FormatType;
  draft: FormatDraft;
  base: FormatVersion;
  openedFrom: number | null;
  onSaved: (saved: FormatVersion) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [name, setName] = useState(draft.name);
  useEffect(() => {
    if (!open) return;
    setNote(openedFrom !== null ? `From version ${openedFrom}` : "");
    setName(draft.name);
  }, [open, openedFrom, draft.name]);

  const save = useApiMutation(saveFormat, {
    invalidate: [FORMATS_PATH],
    onSuccess: res => {
      toast.success(res.message);
      onSaved(res.data);
    }
  });
  const conflict = isApiError(save.error) && save.error.status === 409;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Save version ${base.version + 1}`}
      footerStatus={save.error && !conflict ? errorMessage(save.error) : null}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<Save />}
            loading={save.isPending}
            disabled={conflict || !name.trim()}
            onClick={() => save.mutate({ type, ...draft, name: name.trim(), note: note.trim() || undefined, baseVersion: base.version })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        {conflict && <Alert tone="warning" title="Someone saved this format meanwhile">{errorMessage(save.error)}. Copy your changes, then discard to load the newest version.</Alert>}
        <TextInput label="Name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} hint={type === "REPORT_CARD" ? "Shown in the version history" : "Shown in the version history and on issued certificates' details"} />
        <Textarea label="What changed" rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: new principal's name, bigger logo" />
        <p className="small muted">
          {type === "REPORT_CARD"
            ? "Report cards print with this version from now on. A published report card keeps the version that was in use when it was published."
            : "New certificates use this version from now on. Certificates already issued keep the version they were issued with."}
        </p>
      </div>
    </Dialog>
  );
}

function VersionsDrawer({
  open,
  onClose,
  type,
  inUse,
  canManage,
  dirty,
  onOpen,
  onRestored
}: {
  open: boolean;
  onClose: () => void;
  type: FormatType;
  inUse: number;
  canManage: boolean;
  dirty: boolean;
  onOpen: (version: number) => void;
  onRestored: (saved: FormatVersion) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const versions = useFormatVersions(type, open);
  const restore = useApiMutation(restoreFormat, {
    invalidate: [FORMATS_PATH],
    onSuccess: res => {
      toast.success(res.message);
      onRestored(res.data);
    }
  });

  const ask = async (version: number) => {
    const ok = await confirm({
      title: `Restore version ${version}?`,
      message: `It is saved again as version ${inUse + 1} and new ${type === "REPORT_CARD" ? "report cards" : "certificates"} use it.${dirty ? " Your unsaved changes are discarded." : ""}`,
      confirmLabel: "Restore",
      tone: "primary"
    });
    if (ok) restore.mutate({ type, version });
  };

  const openOld = async (version: number) => {
    if (dirty && !(await confirm({ title: "Discard your changes?", message: `Version ${version} replaces what is in the editor.`, confirmLabel: "Open" }))) return;
    onOpen(version);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Versions" subtitle={`${type === "REPORT_CARD" ? "Report card" : `${FORMAT_SHORT[type]} certificate`} format, newest first`}>
      {versions.isLoading ? (
        <Spinner />
      ) : versions.error ? (
        <Alert tone="danger">{errorMessage(versions.error)}</Alert>
      ) : (
        <ol className="cert-versions">
          {(versions.data ?? []).map(v => (
            <li key={v.id}>
              <div className="row-between">
                <strong>
                  Version {v.version} {v.version === inUse && <Badge tone="success">In use</Badge>}
                </strong>
                <span className="small muted">{formatDateTime(v.createdAt)}</span>
              </div>
              <div className="small muted">{[v.note, v.createdByName && `by ${v.createdByName}`].filter(Boolean).join(" · ") || "No note"}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <Button size="sm" onClick={() => openOld(v.version)}>
                  Open in editor
                </Button>
                {canManage && v.version !== inUse && (
                  <Button size="sm" icon={<RotateCcw />} loading={restore.isPending && restore.variables?.version === v.version} onClick={() => ask(v.version)}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
