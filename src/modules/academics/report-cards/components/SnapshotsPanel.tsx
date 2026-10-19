import { useState } from "react";
import { Archive, FileDown, ShieldAlert } from "lucide-react";
import { useApiGet, useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, Drawer, EmptyState, Select, useToast, type Column } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import {
  downloadSnapshotPdf,
  pct,
  SNAPSHOTS_PATH,
  sourcePaths,
  studentFullName,
  type Publication,
  type ResultSheet,
  type Snapshot,
  type Source
} from "../api/reportCards";
import { ReportCardView } from "./ReportCardView";
import { ResultBadge } from "./ResultBits";

const STATUS_LABELS = { CURRENT: "On the portal", SUPERSEDED: "Replaced", WITHDRAWN: "Withdrawn" } as const;

/* AC-15 Snapshots: report cards exactly as published, every version (sealed; a changed one is refused) */
export function SnapshotsPanel({ source, sectionId, versions }: { source: Source; sectionId: string; versions: Publication[] }) {
  const toast = useToast();
  const { params, setParam, setPage } = useListParams({ studentId: "", version: "" });
  const list = useApiList<Snapshot>(SNAPSHOTS_PATH, {
    ...sourcePaths(source).snapshotFilter,
    sectionId: sectionId || undefined,
    studentId: params.studentId || undefined,
    version: params.version || undefined,
    page: params.page,
    limit: params.limit
  });
  /* Student choices come from the section's sheet */
  const sheetQ = sectionId ? sourcePaths(source).sheet(sectionId) : null;
  const sheet = useApiGet<ResultSheet>(sheetQ?.path ?? null, sheetQ?.query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const opened = useApiGet<Snapshot>(openId ? `${SNAPSHOTS_PATH}/${openId}` : null);

  const pdf = async (s: Snapshot) => {
    setDownloading(s.id);
    try {
      await downloadSnapshotPdf(s.id);
    } catch (err) {
      toast.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const columns: Column<Snapshot>[] = [
    {
      key: "student",
      header: "Student",
      render: s => (
        <div>
          <div className="nowrap">{studentFullName(s.student)}</div>
          <div className="small muted nowrap">{[s.student.rollNumber, s.student.section.name].filter(Boolean).join(" · ")}</div>
        </div>
      )
    },
    { key: "version", header: "Version", render: s => <strong>v{s.version}</strong> },
    { key: "publishedAt", header: "Published", render: s => <span className="nowrap small">{formatDateTime(s.publishedAt)}</span> },
    { key: "result", header: "Result", render: s => <ResultBadge result={s.report.result} /> },
    {
      key: "pct",
      header: "%",
      align: "right",
      render: s => (s.report.display?.percentage ? pct(s.report.percentage) : "") || <span className="muted">—</span>
    },
    {
      key: "status",
      header: "On the portal",
      render: s =>
        s.integrity === "TAMPERED" ? (
          <Badge tone="danger" dot>
            Failed its seal
          </Badge>
        ) : s.publicationStatus ? (
          <Badge tone={s.publicationStatus === "CURRENT" ? "success" : "neutral"} dot>
            {STATUS_LABELS[s.publicationStatus]}
          </Badge>
        ) : null
    },
    {
      key: "pdf",
      header: "",
      align: "right",
      width: 90,
      render: s => (
        <span onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            icon={<FileDown />}
            loading={downloading === s.id}
            disabled={s.integrity !== "VERIFIED"}
            title={s.integrity !== "VERIFIED" ? "This copy failed its integrity check and can't be printed" : "Download the published PDF"}
            onClick={() => void pdf(s)}
          >
            PDF
          </Button>
        </span>
      )
    }
  ];

  const studentOptions = (sheet.data?.students ?? []).map(s => ({
    value: s.studentId,
    label: studentFullName(s),
    description: s.rollNumber ?? undefined
  }));
  const snap = opened.data;

  return (
    <Card flush>
      <div className="filter-bar">
        <Select
          label="Student"
          className="select-sm"
          value={params.studentId}
          onChange={e => setParam("studentId", e.target.value)}
          placeholder={sectionId ? "Every student" : "Pick a section to choose"}
          disabled={!sectionId && !params.studentId}
          options={studentOptions}
        />
        <Select
          label="Version"
          className="select-sm"
          value={params.version}
          onChange={e => setParam("version", e.target.value)}
          placeholder="Every version"
          options={versions.map(v => ({ value: String(v.version), label: `Version ${v.version}` }))}
        />
      </div>
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={s => s.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={s => setOpenId(s.id)}
        empty={
          <EmptyState
            icon={<Archive />}
            title={params.studentId || params.version ? "No published copies match." : "Nothing published yet"}
            message={params.studentId || params.version ? undefined : "Each publication keeps a sealed copy of every report card here."}
          />
        }
      />
      <Drawer
        open={!!openId}
        onClose={() => setOpenId(null)}
        wide
        title={snap ? studentFullName(snap.student) : "Published report card"}
        subtitle={snap ? `${snap.sourceName} · version ${snap.version} · published ${formatDateTime(snap.publishedAt)}` : undefined}
      >
        {snap?.integrity === "TAMPERED" ? (
          <EmptyState
            icon={<ShieldAlert />}
            title="This copy failed its integrity check"
            message="It was changed outside the app and can't be shown or printed. The school has been alerted."
          />
        ) : snap ? (
          <ReportCardView
            report={snap.report}
            actions={
              <Button size="sm" icon={<FileDown />} loading={downloading === snap.id} onClick={() => void pdf(snap)}>
                PDF
              </Button>
            }
          />
        ) : opened.error ? (
          <EmptyState title="Couldn't open this copy" />
        ) : (
          <span className="muted">Loading…</span>
        )}
      </Drawer>
    </Card>
  );
}
