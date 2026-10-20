/* AC-19 · Certificates: bonafide, character and transfer certificates issued to students,
   newest first, and generating one; the Formats tab edits each certificate's HTML + CSS
   (every save a new version). */
import { useEffect, useState } from "react";
import { FileBadge, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useDebounce, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, SearchInput, Select, Tabs, useTabParam, type Column } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { PageIntro } from "../../shared/components/PageIntro";
import { CERTIFICATES_PATH, TYPE_ORDER, TYPE_SHORT, type Certificate } from "../api/certificates";
import { CertificateDialog, CertificateStatus } from "../components/CertificateDialog";
import { FormatEditor } from "../components/FormatEditor";
import { IssueCertificateDialog } from "../components/IssueCertificateDialog";

export default function CertificatesPage() {
  const { can } = useAuth();
  const tabs = [
    { id: "issued", label: "Issued certificates", hidden: !can("academics.certificates.read") },
    { id: "formats", label: "Formats", hidden: !can("academics.certificateFormats.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  return (
    <Page>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "issued" ? <IssuedCertificates /> : <FormatEditor />}
    </Page>
  );
}

function IssuedCertificates() {
  const { can } = useAuth();
  const { params, setParam, setPage } = useListParams({ type: "", status: "", search: "" });
  const [search, setSearch] = useState(params.search);
  const debounced = useDebounce(search.trim(), 300);
  useEffect(() => {
    if (debounced !== params.search) setParam("search", debounced);
  }, [debounced, params.search, setParam]);
  const list = useApiList<Certificate>(CERTIFICATES_PATH, params);
  const [issuing, setIssuing] = useState(false);
  const [open, setOpen] = useState<Certificate | null>(null);
  const filtered = !!(params.type || params.status || params.search);

  const columns: Column<Certificate>[] = [
    { key: "serial", header: "Number", render: c => <span className="mono nowrap">{c.serialNumber}</span> },
    { key: "type", header: "Certificate", render: c => <span className="nowrap">{c.label}</span> },
    {
      key: "student",
      header: "Student",
      render: c => (
        <div style={{ minWidth: 160 }}>
          <strong>{c.student.name}</strong>
          <div className="small muted">{c.student.admissionNumber}</div>
        </div>
      )
    },
    { key: "class", header: "Class", render: c => <span className="nowrap">{c.student.classSection || "—"}</span> },
    {
      key: "issued",
      header: "Issued",
      render: c => (
        <div className="nowrap">
          {formatDateTime(c.issuedAt)}
          {c.issuedBy && <div className="small muted">by {c.issuedBy.name}</div>}
        </div>
      )
    },
    { key: "status", header: "Status", render: c => <CertificateStatus certificate={c} /> }
  ];

  const issueButton = can("academics.certificates.issue") && (
    <Button variant="primary" icon={<Plus />} onClick={() => setIssuing(true)}>
      Generate certificate
    </Button>
  );

  return (
    <>
      <PageIntro actions={issueButton}>Certificates issued to students, newest first. Open one to view, print or cancel it.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <SearchInput placeholder="Student, admission or certificate number" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" />
          <Select
            label="Certificate"
            className="select-sm"
            value={params.type}
            onChange={e => setParam("type", e.target.value)}
            options={TYPE_ORDER.map(t => ({ value: t, label: TYPE_SHORT[t] }))}
            placeholder="All certificates"
          />
          <Select
            label="Status"
            className="select-sm"
            value={params.status}
            onChange={e => setParam("status", e.target.value)}
            options={[
              { value: "ISSUED", label: "Issued" },
              { value: "CANCELLED", label: "Cancelled" }
            ]}
            placeholder="Any status"
          />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={setOpen}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<FileBadge />} title="No certificates match" message="Try another name, number or filter." />
            ) : (
              <EmptyState icon={<FileBadge />} title="No certificates yet" message="Bonafide, character and transfer certificates you issue are listed here." actions={issueButton} />
            )
          }
        />
      </Card>
      <IssueCertificateDialog
        open={issuing}
        onClose={() => setIssuing(false)}
        onIssued={c => {
          setIssuing(false);
          setOpen(c);
        }}
      />
      <CertificateDialog certificate={open} onClose={() => setOpen(null)} />
    </>
  );
}
