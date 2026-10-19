import { useState } from "react";
import { CheckCircle2, EyeOff, Megaphone, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, useConfirm, useToast, type Column } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { checkIntegrity, publish, publishVersion, withdraw, type Integrity, type Publication, type Source } from "../api/reportCards";

const STATUS_TONES = { CURRENT: "success", SUPERSEDED: "neutral", WITHDRAWN: "warning" } as const;
const STATUS_LABELS = { CURRENT: "On the portal", SUPERSEDED: "Replaced", WITHDRAWN: "Withdrawn" } as const;

/* Every query this page shows that publishing changes */
const RESULT_QUERY_PREFIXES = ["/academics/exams", "/academics/assessment-schemes", "/academics/report-cards"];

/* AC-15 Publication: publish, publish a corrected version, withdraw; every version with its integrity check */
export function PublicationPanel({
  source,
  canPublish,
  sectionCount,
  versions
}: {
  source: Source;
  canPublish: boolean;
  sectionCount: number | null;
  versions: ReturnType<typeof useApiList<Publication>>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { readOnly } = useAcademicYear();
  const [busy, setBusy] = useState<"publish" | "version" | "withdraw" | null>(null);
  const [checks, setChecks] = useState<Record<number, Integrity | "checking">>({});
  const rows = versions.rows ?? [];
  const current = rows.find(v => v.status === "CURRENT");
  const latest = rows[0];
  const published = !!source.publishedAt;
  const actions = canPublish && !readOnly;

  const refresh = () =>
    qc.invalidateQueries({
      predicate: q => typeof q.queryKey[0] === "string" && RESULT_QUERY_PREFIXES.some(p => (q.queryKey[0] as string).startsWith(p))
    });

  const run = async (kind: "publish" | "version" | "withdraw", fn: () => Promise<{ message: string }>) => {
    setBusy(kind);
    try {
      const res = await fn();
      toast.success(res.message);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const doPublish = async () => {
    const ok = await confirm({
      title: `Publish ${source.name} results?`,
      message: `Students and parents${sectionCount ? ` of ${sectionCount} section${sectionCount === 1 ? "" : "s"}` : ""} are notified once and see these results. Every report card is frozen as version ${(latest?.version ?? 0) + 1}.`,
      confirmLabel: "Publish results",
      tone: "primary"
    });
    if (ok) await run("publish", () => publish(source));
  };

  const doVersion = async () => {
    const ok = await confirm({
      title: `Publish a new version of ${source.name}?`,
      message: `Today's results replace version ${current?.version ?? latest?.version ?? ""} on the portal. Earlier versions are kept for staff. Families are not notified again.`,
      confirmLabel: "Publish new version",
      tone: "primary"
    });
    if (ok) await run("version", () => publishVersion(source));
  };

  const doWithdraw = async () => {
    const ok = await confirm({
      title: `Withdraw ${source.name} results?`,
      message: "Results disappear from the portal; staff keep every version.",
      confirmLabel: "Withdraw results"
    });
    if (ok) await run("withdraw", () => withdraw(source));
  };

  const check = async (v: Publication) => {
    setChecks(c => ({ ...c, [v.version]: "checking" }));
    try {
      const res = await checkIntegrity(source, v.version);
      setChecks(c => ({ ...c, [v.version]: res.data }));
      if (res.data.intact) toast.success(res.message);
      else toast.error(res.message);
    } catch (err) {
      setChecks(c => {
        const next = { ...c };
        delete next[v.version];
        return next;
      });
      toast.error(isApiError(err) ? err : "Couldn't check this version");
    }
  };

  const columns: Column<Publication>[] = [
    { key: "version", header: "Version", width: 90, render: v => <strong>v{v.version}</strong> },
    {
      key: "status",
      header: "Status",
      render: v => (
        <Badge tone={STATUS_TONES[v.status]} dot>
          {STATUS_LABELS[v.status]}
        </Badge>
      )
    },
    {
      key: "publishedAt",
      header: "Published",
      render: v => (
        <div>
          <div className="nowrap">{formatDateTime(v.publishedAt)}</div>
          {v.publisher && (
            <div className="small muted">
              by {v.publisher.firstName} {v.publisher.lastName}
            </div>
          )}
        </div>
      )
    },
    { key: "reportCount", header: "Report cards", align: "right", render: v => v.reportCount },
    {
      key: "changedCount",
      header: "Changed",
      align: "right",
      render: v => (v.changedCount === null ? <span className="muted">First</span> : v.changedCount)
    },
    {
      key: "end",
      header: "Ended",
      render: v =>
        v.withdrawnAt ? (
          <span className="small nowrap">Withdrawn {formatDateTime(v.withdrawnAt)}</span>
        ) : v.supersededAt ? (
          <span className="small nowrap muted">Replaced {formatDateTime(v.supersededAt)}</span>
        ) : (
          <span className="muted">—</span>
        )
    },
    ...(canPublish
      ? [
          {
            key: "integrity",
            header: "Integrity",
            width: 210,
            render: (v: Publication) => {
              const c = checks[v.version];
              if (c && c !== "checking")
                return c.intact ? (
                  <span className="row nowrap rc-intact" style={{ gap: 4 }} title={`All ${c.expected} report cards match their seals`}>
                    <ShieldCheck size={15} /> Intact ({c.verified}/{c.expected})
                  </span>
                ) : (
                  <span
                    className="row nowrap rc-tampered"
                    style={{ gap: 4 }}
                    title={`${c.tampered.length} changed, ${c.missing.length} missing, ${c.unexpected.length} not part of the publication`}
                  >
                    <ShieldAlert size={15} /> Failed: {c.tampered.length} changed, {c.missing.length} missing
                  </span>
                );
              return (
                <Button size="sm" variant="ghost" icon={<ShieldCheck />} loading={c === "checking"} onClick={() => void check(v)}>
                  Check integrity
                </Button>
              );
            }
          }
        ]
      : [])
  ];

  const statusText = published
    ? `Published as version ${current?.version ?? "…"}${current ? ` on ${formatDateTime(current.publishedAt)}` : ""}. Families see these results.`
    : latest
      ? `Withdrawn: version ${latest.version} is hidden from the portal. Publishing again makes version ${latest.version + 1}.`
      : "Not published. Students and parents see nothing until you publish.";

  return (
    <div className="stack">
      <Card>
        <div className="row-between" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 10, minWidth: 0, flex: 1, flexWrap: "nowrap" }}>
            {published ? <CheckCircle2 className="rc-status-icon is-on" /> : <EyeOff className="rc-status-icon" />}
            <span className="rc-status-text" title={statusText}>
              {versions.isLoading ? "Loading versions…" : statusText}
            </span>
          </div>
          {actions && (
            <div className="row">
              {published ? (
                <>
                  <Button icon={<EyeOff />} loading={busy === "withdraw"} disabled={!!busy} onClick={() => void doWithdraw()}>
                    Withdraw
                  </Button>
                  <Button variant="primary" icon={<RefreshCw />} loading={busy === "version"} disabled={!!busy} onClick={() => void doVersion()}>
                    Publish new version
                  </Button>
                </>
              ) : (
                <Button variant="primary" icon={<Megaphone />} loading={busy === "publish"} disabled={!!busy} onClick={() => void doPublish()}>
                  Publish results
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
      <Card flush title="Versions" subtitle="Each publication freezes every report card; the newest is first">
        <DataTable
          columns={columns}
          rows={versions.rows}
          rowKey={v => v.id}
          loading={versions.isLoading}
          error={versions.error}
          onRetry={() => void versions.refetch()}
          empty={
            <EmptyState icon={<Megaphone />} title="Never published" message={`Versions appear here once ${source.name} results are published.`} />
          }
        />
      </Card>
    </div>
  );
}
