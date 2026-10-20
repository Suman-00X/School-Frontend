import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, FileBadge } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, Dialog, EmptyState, Page, PageHeader, Tabs, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { CERTIFICATE_TYPE_ORDER, CERTIFICATE_TYPE_SHORT, CertificatePreview, openPdf } from "@/modules/academics";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { certificatesPath, downloadPortalCertificate, portalCertificateDocument, portalCertificatePdf, type PortalCertificate } from "../api/certificates";

/* What an empty tab says */
const EMPTY_TITLE: Record<string, string> = {
  "": "No certificates yet",
  BONAFIDE: "No bonafide certificates",
  CHARACTER: "No character certificates",
  TRANSFER: "No transfer certificate"
};

const TABS = [{ id: "", label: "All" }, ...CERTIFICATE_TYPE_ORDER.map(type => ({ id: type, label: CERTIFICATE_TYPE_SHORT[type] }))];

/* PO-13 · Certificates: the bonafide, character and transfer certificates the school issued
   to the child, newest first, to view and download. The PDF is the one the office prints. */
export default function CertificatesPage() {
  const { student } = usePortalStudent();
  const toast = useToast();
  const { params, setParams, setPage } = useListParams({ type: "" });
  const list = useApiList<PortalCertificate>(certificatesPath(student.id), { type: params.type || undefined, page: params.page, limit: params.limit });
  const [open, setOpen] = useState<PortalCertificate | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (c: PortalCertificate) => {
    setDownloading(c.id);
    try {
      await downloadPortalCertificate(student.id, c);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(null);
    }
  };

  const columns: Column<PortalCertificate>[] = [
    { key: "label", header: "Certificate", render: c => <strong>{c.label}</strong> },
    { key: "serialNumber", header: "Number", render: c => <span className="nowrap">{c.serialNumber}</span> },
    { key: "classSection", header: "Class", render: c => c.student.classSection || <span className="muted">—</span> },
    { key: "issuedAt", header: "Issued on", render: c => <span className="nowrap">{formatDate(c.issuedAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: c => (
        <div className="row" style={{ justifyContent: "flex-end", gap: 6 }} onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setOpen(c)}>
            View
          </Button>
          <Button size="sm" icon={<Download />} loading={downloading === c.id} onClick={() => void download(c)}>
            Download
          </Button>
        </div>
      )
    }
  ];

  return (
    <Page>
      <PageHeader title="Certificates" subtitle={studentFullName(student)} />
      {list.error ? (
        <PortalError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Card flush>
          <div style={{ padding: "0 14px" }}>
            <Tabs tabs={TABS} value={params.type} onChange={id => setParams({ type: id })} />
          </div>
          <DataTable
            rows={list.rows}
            rowKey={c => c.id}
            loading={list.isLoading}
            meta={list.meta}
            onPageChange={setPage}
            onRowClick={setOpen}
            columns={columns}
            empty={
              <EmptyState
                icon={<FileBadge />}
                title={EMPTY_TITLE[params.type] ?? EMPTY_TITLE[""]}
                message="Certificates the school office issues (bonafide, character, transfer) show here to view and download."
              />
            }
          />
        </Card>
      )}
      <CertificateViewer studentId={student.id} certificate={open} onClose={() => setOpen(null)} onDownload={download} downloading={!!open && downloading === open.id} />
    </Page>
  );
}

function CertificateViewer({
  studentId,
  certificate: c,
  onClose,
  onDownload,
  downloading
}: {
  studentId: string;
  certificate: PortalCertificate | null;
  onClose: () => void;
  onDownload: (c: PortalCertificate) => Promise<void>;
  downloading: boolean;
}) {
  const toast = useToast();
  const doc = useQuery({
    queryKey: [c ? `${certificatesPath(studentId)}/${c.id}/document` : ""],
    enabled: !!c,
    queryFn: async () => (await portalCertificateDocument(studentId, c!.id)).data.html
  });

  if (!c) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      full
      title={`${c.label} ${c.serialNumber}`}
      footer={
        <>
          <Button icon={<ExternalLink />} onClick={() => openPdf(() => portalCertificatePdf(studentId, c.id)).catch(e => toast.error(e))}>
            Open PDF
          </Button>
          <Button variant="primary" icon={<Download />} loading={downloading} onClick={() => void onDownload(c)}>
            Download PDF
          </Button>
        </>
      }
    >
      {/* One A4 page wide, centred */}
      <div style={{ maxWidth: 828, margin: "0 auto" }}>
        <CertificatePreview html={doc.data ?? null} loading={doc.isLoading} error={doc.error ? errorMessage(doc.error) : null} />
      </div>
    </Dialog>
  );
}
