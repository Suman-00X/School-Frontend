import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileBadge } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useApiMutation, useDebounce } from "@/common/hooks";
import { Alert, Button, Checkbox, Dialog, RadioGroup, Select, Spinner, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import {
  CERTIFICATES_PATH,
  getDraft,
  issueCertificate,
  previewCertificate,
  TYPE_ORDER,
  useCertificateTypes,
  type Certificate,
  type CertificateInput,
  type CertificateType
} from "../api/certificates";
import { CertificatePreview } from "./CertificatePreview";

/* Issue a certificate: pick the type and the student, check the details the server filled in
   (attendance for a TC), see it as it will print, issue. */
export function IssueCertificateDialog({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: (c: Certificate) => void }) {
  const toast = useToast();
  const types = useCertificateTypes();
  const [type, setType] = useState<CertificateType | "">("");
  const [studentId, setStudentId] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [markLeft, setMarkLeft] = useState(true);

  useEffect(() => {
    if (!open) {
      setType("");
      setStudentId("");
      setInputs({});
    }
  }, [open]);

  const info = types.data?.find(t => t.type === type);
  const draft = useQuery({
    queryKey: [`${CERTIFICATES_PATH}/draft`, type, studentId],
    enabled: open && !!type && !!studentId,
    queryFn: async () => (await getDraft(type as CertificateType, studentId)).data
  });

  /* A new type or student starts from the server's values */
  useEffect(() => {
    if (draft.data) {
      setInputs(draft.data.inputs);
      setMarkLeft(draft.data.enrollmentStatus === "ACTIVE");
    }
  }, [draft.data]);

  const ready = !!draft.data && draft.data.type === type && draft.data.studentId === studentId;
  const missing = (info?.inputs ?? []).filter(i => i.required && !inputs[i.key]?.trim());
  const debounced = useDebounce(inputs, 400);
  const preview = useQuery({
    queryKey: [`${CERTIFICATES_PATH}/preview`, type, studentId, debounced],
    enabled: open && ready && !missing.length,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async ({ signal }) => (await previewCertificate({ type: type as CertificateType, studentId, inputs: debounced }, signal)).data.html
  });

  const issue = useApiMutation(issueCertificate, {
    invalidate: [CERTIFICATES_PATH],
    onSuccess: res => {
      toast.success(res.message);
      onIssued(res.data);
    }
  });

  const typeOptions = useMemo(
    () => TYPE_ORDER.flatMap(t => types.data?.filter(x => x.type === t) ?? []).map(t => ({ value: t.type, label: t.label, description: t.description })),
    [types.data]
  );

  const set = (key: string, value: string) => setInputs(prev => ({ ...prev, [key]: value }));
  const blocked = ready ? draft.data!.blocked : null;
  const canIssue = ready && !blocked && !missing.length && !issue.isPending;
  const earlier = ready ? draft.data!.earlier.filter(c => c.status === "ISSUED") : [];

  const submit = () =>
    issue.mutate({ type: type as CertificateType, studentId, inputs, markLeft: type === "TRANSFER" && markLeft });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      full
      title="Generate a certificate"
      footerStatus={issue.error ? errorMessage(issue.error) : blocked}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<FileBadge />} disabled={!canIssue} loading={issue.isPending} onClick={submit}>
            Issue certificate
          </Button>
        </>
      }
    >
      <div className="cert-issue">
        <div className="stack cert-issue-form">
          {types.isLoading ? <Spinner /> : <RadioGroup aria-label="Certificate" options={typeOptions} value={type} onChange={setType} />}
          <StudentSelect value={studentId} onChange={e => setStudentId(e.target.value)} required placeholder="Search by name or admission number" />

          {type && studentId && !ready && (draft.isLoading ? <Spinner /> : draft.error && <Alert tone="danger">{errorMessage(draft.error)}</Alert>)}

          {ready && info && (
            <>
              {draft.data!.enrollmentStatus === "LEFT" && type !== "TRANSFER" && (
                <Alert tone="warning">{draft.data!.student.name} has left the school.</Alert>
              )}
              {earlier.length > 0 && !blocked && (
                <Alert tone="info" title={`Already issued to ${draft.data!.student.name}`}>
                  {earlier.map(c => `${c.serialNumber} on ${formatDate(c.issuedAt)}`).join(" · ")}
                </Alert>
              )}
              {blocked && <Alert tone="warning">{blocked}</Alert>}
              <div className="form-grid">
                {info.inputs.map(input => (
                  <InputField key={input.key} input={input} value={inputs[input.key] ?? ""} onChange={value => set(input.key, value)} />
                ))}
              </div>
              {type === "TRANSFER" && draft.data!.enrollmentStatus === "ACTIVE" && (
                <Checkbox
                  checked={markLeft}
                  onChange={e => setMarkLeft(e.target.checked)}
                  label={`Mark ${draft.data!.student.name} as left the school (${draft.data!.student.classSection})`}
                />
              )}
            </>
          )}
        </div>
        <CertificatePreview
          html={ready && !missing.length ? (preview.data ?? null) : null}
          loading={preview.isFetching}
          error={preview.error ? errorMessage(preview.error) : null}
          empty={
            !type || !studentId
              ? "Pick a certificate and a student to see it here."
              : missing.length
                ? `Fill in ${missing.map(m => m.label.toLowerCase()).join(", ")} to see the certificate.`
                : null
          }
        />
      </div>
    </Dialog>
  );
}

function InputField({ input, value, onChange }: { input: CertificateInput; value: string; onChange: (value: string) => void }) {
  const common = { label: input.label, required: input.required, hint: input.hint };
  switch (input.kind) {
    case "textarea":
      return <Textarea {...common} fieldClassName="span-2" rows={2} maxLength={input.max} value={value} onChange={e => onChange(e.target.value)} />;
    case "choice":
      return <Select {...common} options={(input.options ?? []).map(o => ({ value: o, label: o }))} value={value} onChange={e => onChange(e.target.value)} placeholder="Choose" />;
    case "date":
      return <TextInput {...common} type="date" value={value} onChange={e => onChange(e.target.value)} />;
    case "number":
      return <TextInput {...common} type="number" min={0} step="any" value={value} onChange={e => onChange(e.target.value)} />;
    default:
      return <TextInput {...common} fieldClassName={input.max && input.max > 100 ? "span-2" : undefined} maxLength={input.max} value={value} onChange={e => onChange(e.target.value)} />;
  }
}
