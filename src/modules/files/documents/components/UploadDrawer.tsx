import { useState, type FormEvent } from "react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Drawer, Field, FileDrop, RadioGroup, Select, TextInput, useToast } from "@/common/ui";
import { formatBytes } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { FILE_RULES, FILES_PATH, OWNER_LABELS, uploadFile, useStaffRecords, type FileCategory, type OwnerType } from "../api/documents";

/* FL-01 upload: who the file belongs to, what kind it is, a description and the file itself.
   Every field keeps its place whatever is chosen (the owner field is disabled for General). */
export function UploadDrawer({ ownerType: initialType, ownerId: initialOwner, onClose }: { ownerType: OwnerType; ownerId?: string; onClose: () => void }) {
  const toast = useToast();
  const staff = useStaffRecords();
  const [ownerType, setOwnerType] = useState<OwnerType>(initialType);
  const [ownerId, setOwnerId] = useState(initialOwner ?? "");
  const [category, setCategory] = useState<FileCategory>("DOCUMENT");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const upload = useApiMutation(uploadFile, { invalidate: [FILES_PATH] });
  const rule = FILE_RULES[category];

  const clear = (k: string) => {
    setErrors(e => ({ ...e, [k]: "" }));
    setFormError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (ownerType !== "GENERAL" && !ownerId) errs.ownerId = ownerType === "STUDENT" ? "Pick the student" : "Pick the staff member";
    if (!file) errs.file = "Choose a file";
    setErrors(errs);
    setFormError(Object.keys(errs).length ? "Fill in the highlighted fields." : null);
    if (Object.keys(errs).length) return;
    upload.mutate(
      { ownerType, ownerId, category, description, file: file! },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) {
            const f = err.fieldErrors();
            setErrors(f);
            setFormError(f.file ?? "Check the highlighted fields.");
          } else if (isApiError(err) && err.status === 422 && /ownerId/.test(err.message)) {
            setErrors({ ownerId: ownerType === "STUDENT" ? "That student wasn't found" : "That staff member wasn't found" });
            setFormError(err.message);
          } else setFormError(errorMessage(err));
        }
      }
    );
  };

  const staffBlocked = ownerType === "STAFF" && !staff.allowed;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Upload a document"
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="file-upload" variant="primary" loading={upload.isPending} disabled={staffBlocked}>
            Upload
          </Button>
        </>
      }
    >
      <form id="file-upload" className="stack" onSubmit={submit} noValidate>
        <Field label="Belongs to">
          <RadioGroup
            value={ownerType}
            onChange={t => {
              setOwnerType(t);
              setOwnerId("");
              clear("ownerId");
            }}
            options={[
              { value: "STUDENT", label: OWNER_LABELS.STUDENT.one, description: "Certificates, ID copies, a photo" },
              { value: "STAFF", label: OWNER_LABELS.STAFF.one, description: "Contracts, qualifications (not teachers)" },
              { value: "GENERAL", label: OWNER_LABELS.GENERAL.one, description: "Circulars, forms, policies" }
            ]}
          />
        </Field>
        {ownerType === "STUDENT" ? (
          <StudentSelect
            required
            value={ownerId}
            onChange={e => {
              setOwnerId(e.target.value);
              clear("ownerId");
            }}
            error={errors.ownerId || undefined}
          />
        ) : ownerType === "STAFF" ? (
          <Select
            label="Staff member"
            required
            value={ownerId}
            options={staff.options}
            searchable
            disabled={!staff.allowed}
            placeholder={!staff.allowed ? "You can't list staff records" : staff.isLoading ? "Loading staff…" : "Search by name or code"}
            hint={staff.allowed ? "Teachers' documents go under Whole school" : "Ask an administrator to file staff documents"}
            onChange={e => {
              setOwnerId(e.target.value);
              clear("ownerId");
            }}
            error={errors.ownerId || undefined}
          />
        ) : (
          <Select label="Owner" value="" options={[]} disabled placeholder="Not needed: the whole school" hint="Anyone with access to documents can see it" error={undefined} />
        )}
        <Field label="Kind">
          <RadioGroup
            value={category}
            onChange={c => {
              setCategory(c);
              if (file && (file.size > FILE_RULES[c].maxBytes || (c === "PHOTO" && !file.type.startsWith("image/")))) setFile(null);
              clear("file");
            }}
            options={[
              { value: "DOCUMENT", label: "Document", description: FILE_RULES.DOCUMENT.hint },
              { value: "PHOTO", label: "Photo", description: FILE_RULES.PHOTO.hint }
            ]}
          />
        </Field>
        <TextInput label="Description" maxLength={300} placeholder="e.g. Birth certificate" value={description} onChange={e => setDescription(e.target.value)} hint="Optional, up to 300 characters" />
        <Field label="File" required error={errors.file || undefined} hint={file ? `${formatBytes(file.size)} of ${formatBytes(rule.maxBytes)}` : undefined}>
          <FileDrop
            accept={rule.accept}
            maxBytes={rule.maxBytes}
            hint={rule.hint}
            file={file}
            onFile={f => {
              setFile(f);
              clear("file");
            }}
            onReject={m => {
              setErrors(e => ({ ...e, file: m }));
            }}
          />
        </Field>
      </form>
    </Drawer>
  );
}
