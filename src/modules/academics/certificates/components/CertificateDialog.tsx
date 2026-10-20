import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Download, ExternalLink } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Alert, Badge, Button, DescriptionList, Dialog, Textarea, useToast } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import {
  cancelCertificate,
  certificateDocument,
  certificatePath,
  certificatePdf,
  CERTIFICATES_PATH,
  downloadCertificate,
  openPdf,
  useCertificateTypes,
  type Certificate
} from "../api/certificates";
import { CertificatePreview } from "./CertificatePreview";

export function CertificateStatus({ certificate }: { certificate: Certificate }) {
  return certificate.status === "ISSUED" ? <Badge tone="success" dot>Issued</Badge> : <Badge tone="danger" dot>Cancelled</Badge>;
}

/* One issued certificate as it prints, with its PDF, and cancelling it (management) */
export function CertificateDialog({ certificate, onClose }: { certificate: Certificate | null; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const types = useCertificateTypes();
  const [current, setCurrent] = useState<Certificate | null>(certificate);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrent(certificate);
    setCancelling(false);
    setReason("");
  }, [certificate]);

  const c = current;
  const doc = useQuery({
    queryKey: [c ? `${certificatePath(c.id)}/document` : "", c?.status],
    enabled: !!c,
    queryFn: async () => (await certificateDocument(c!.id)).data.html
  });

  const cancel = useApiMutation(cancelCertificate, {
    invalidate: [CERTIFICATES_PATH],
    onSuccess: res => {
      toast.success(res.message);
      setCurrent(res.data);
      setCancelling(false);
    }
  });

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  if (!c) return null;
  /* What was entered when issuing, labelled and in the type's order */
  const inputs = (types.data?.find(t => t.type === c.type)?.inputs ?? [])
    .filter(input => c.inputs[input.key])
    .map(input => ({ label: input.label, value: input.kind === "date" ? formatDate(c.inputs[input.key]) : c.inputs[input.key] }));

  return (
    <Dialog
      open
      onClose={onClose}
      full
      title={`${c.label} ${c.serialNumber}`}
      footerStatus={cancel.error ? errorMessage(cancel.error) : null}
      footer={
        cancelling ? (
          <>
            <Button onClick={() => setCancelling(false)}>Keep it</Button>
            <Button
              variant="danger"
              icon={<Ban />}
              disabled={!reason.trim()}
              loading={cancel.isPending}
              onClick={() => cancel.mutate({ id: c.id, reason: reason.trim() })}
            >
              Cancel certificate
            </Button>
          </>
        ) : (
          <>
            {can("academics.certificates.cancel") && c.status === "ISSUED" && (
              <Button variant="ghost" icon={<Ban />} onClick={() => setCancelling(true)}>
                Cancel certificate…
              </Button>
            )}
            <Button icon={<ExternalLink />} disabled={busy} onClick={() => run(() => openPdf(() => certificatePdf(c.id)))}>
              Open PDF
            </Button>
            <Button variant="primary" icon={<Download />} loading={busy} onClick={() => run(() => downloadCertificate(c))}>
              Download PDF
            </Button>
          </>
        )
      }
    >
      <div className="cert-issue">
        <div className="stack cert-issue-form">
          {cancelling && (
            <Alert tone="warning" title="Cancel this certificate?">
              It stays in the list and prints with CANCELLED across it.
              {c.type === "TRANSFER" && " The student is not re-enrolled: do that from Enrollments if they return."}
            </Alert>
          )}
          {cancelling && <Textarea label="Reason" required rows={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} autoFocus />}
          {c.status === "CANCELLED" && (
            <Alert tone="danger" title={`Cancelled ${formatDateTime(c.cancelledAt)}`}>
              {c.cancelReason}
            </Alert>
          )}
          <DescriptionList
            columns={1}
            items={[
              { label: "Status", value: <CertificateStatus certificate={c} /> },
              { label: "Student", value: `${c.student.name} · ${c.student.admissionNumber}` },
              { label: "Class", value: c.student.classSection || "—" },
              { label: "Issued", value: `${formatDateTime(c.issuedAt)}${c.issuedBy ? ` by ${c.issuedBy.name}` : ""}` },
              { label: "Format", value: c.formatVersion.version ? `${c.formatVersion.name ?? c.label}, version ${c.formatVersion.version}` : "—" }
            ]}
          />
          {inputs.length > 0 && (
            <DescriptionList columns={1} items={inputs} />
          )}
        </div>
        <CertificatePreview html={doc.data ?? null} loading={doc.isLoading} error={doc.error ? errorMessage(doc.error) : null} />
      </div>
    </Dialog>
  );
}
