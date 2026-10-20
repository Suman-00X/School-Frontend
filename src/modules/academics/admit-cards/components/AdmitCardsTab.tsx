/* AC-13 · An exam's Admit cards tab: each student judged against the exam eligibility rules,
   their card, and generating the cards (only eligible students get one) */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileBadge, MoreHorizontal, ShieldCheck, ShieldOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  Select,
  SkeletonBlock,
  Textarea,
  useConfirm,
  useToast,
  type Column
} from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import {
  EXAM_ELIGIBILITY_PAGE,
  eligibilityPath,
  exemptStudent,
  removeExemption,
  rulesSentence,
  type ExamEligibility,
  type StudentEligibility
} from "../../exam-eligibility/api/examEligibility";
import { admitCardsPath, downloadAdmitCard, downloadSectionAdmitCards, generateAdmitCards, type AdmitCard } from "../api/admitCards";
import "../admitCards.css";

type Row = StudentEligibility & { section: { id: string; name: string }; card?: AdmitCard };

const fullName = (r: Pick<StudentEligibility, "firstName" | "lastName">) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();

export function AdmitCardsTab({ exam }: { exam: { id: string; examName: string } }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const currency = useSchoolCurrency();
  const money = (n: number) => formatMoney(n, currency);
  const [sectionId, setSectionId] = useState("");
  const [exempting, setExempting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const canGenerate = can("academics.admitCards.generate") && !readOnly;
  const canExempt = can("academics.examEligibility.exempt") && !readOnly;

  const eligibility = useApiGet<ExamEligibility>(eligibilityPath(exam.id));
  const cards = useApiGet<AdmitCard[]>(admitCardsPath(exam.id));
  const data = eligibility.data;

  const rows = useMemo<Row[]>(() => {
    const cardOf = new Map((cards.data ?? []).map(c => [c.studentId, c]));
    return (data?.sections ?? [])
      .filter(s => !sectionId || s.section.id === sectionId)
      .flatMap(s => s.students.map(st => ({ ...st, section: s.section, card: cardOf.get(st.studentId) })));
  }, [data, cards.data, sectionId]);

  const refresh = () =>
    qc.invalidateQueries({
      predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0].startsWith(eligibilityPath(exam.id)) || q.queryKey[0].startsWith(admitCardsPath(exam.id)))
    });

  const sectionName = data?.sections.find(s => s.section.id === sectionId)?.section.name;
  const eligibleCount = rows.filter(r => r.eligible).length;
  const withdrawing = rows.filter(r => !r.eligible && r.card?.status === "ISSUED").length;
  const issuedHere = rows.filter(r => r.card?.status === "ISSUED").length;

  const generate = async () => {
    const scope = sectionName ? `in ${sectionName}` : "sitting the exam";
    const ok = await confirm({
      title: `Generate admit cards for ${exam.examName}?`,
      message: `${eligibleCount} of ${rows.length} students ${scope} are eligible and will have an admit card, with the current date sheet. ${
        withdrawing ? `${withdrawing} card${withdrawing === 1 ? " is" : "s are"} withdrawn from students no longer eligible. ` : ""
      }Students and parents see the card in the portal and are notified.`,
      confirmLabel: "Generate admit cards",
      tone: "primary"
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await generateAdmitCards({ examId: exam.id, sectionId: sectionId || undefined });
      await refresh();
      toast.success(res.message);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const unexempt = async (r: Row) => {
    const ok = await confirm({
      title: `Apply the rules to ${fullName(r)} again?`,
      message: `${fullName(r)} no longer has permission to sit ${exam.examName} despite the rules. An admit card already issued stays until the cards are generated again.`,
      confirmLabel: "Remove exemption"
    });
    if (!ok) return;
    try {
      const res = await removeExemption({ examId: exam.id, studentId: r.studentId });
      await refresh();
      toast.success(res.message);
    } catch (err) {
      toast.error(err);
    }
  };

  const download = async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<Row>[] = [
    { key: "roll", header: "Roll no.", width: 100, render: r => <span className="mono small">{r.rollNumber ?? "—"}</span> },
    {
      key: "name",
      header: "Student",
      render: r => (
        <span>
          {fullName(r)}
          {!sectionId && <span className="muted small"> · {r.section.name}</span>}
        </span>
      )
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "right",
      render: r =>
        r.attendance.percentage === null ? (
          <span className="muted">—</span>
        ) : (
          <span className={r.attendance.met ? undefined : "ac-short"}>{r.attendance.percentage}%</span>
        )
    },
    {
      key: "dues",
      header: "Overdue fees",
      align: "right",
      render: r => (r.dues.overdue > 0 ? <span className={r.dues.met ? undefined : "ac-short"}>{money(r.dues.overdue)}</span> : <span className="muted">None</span>)
    },
    {
      key: "eligibility",
      header: "Eligibility",
      render: r =>
        r.meetsRules ? (
          <Badge tone="success">Eligible</Badge>
        ) : r.exemption ? (
          <span title={`Allowed despite the rules: ${r.exemption.reason}`}>
            <Badge tone="info">Exempted</Badge>
          </span>
        ) : (
          <span title={r.reasons.join("\n")}>
            <Badge tone="danger">Not eligible</Badge>
          </span>
        )
    },
    {
      key: "card",
      header: "Admit card",
      render: r =>
        r.card?.status === "ISSUED" ? (
          <span className="nowrap">
            <Badge tone="success" dot>
              Issued
            </Badge>{" "}
            <span className="muted small">{formatDate(r.card.issuedAt)}</span>
          </span>
        ) : r.card?.status === "WITHDRAWN" ? (
          <span title={r.card.withdrawnReason ?? undefined}>
            <Badge tone="warning">Withdrawn</Badge>
          </span>
        ) : (
          <span className="muted">Not issued</span>
        )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 60,
      render: r => {
        const issued = r.card?.status === "ISSUED" ? r.card : null;
        const exemptable = canExempt && !r.meetsRules;
        if (!issued && !exemptable) return null;
        return (
          <div className="row-actions" onClick={ev => ev.stopPropagation()}>
            <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${fullName(r)}`} title="More" />}>
              {close => (
                <>
                  {issued && (
                    <MenuItem
                      icon={<Download />}
                      onClick={() => {
                        close();
                        void download(() => downloadAdmitCard(issued));
                      }}
                    >
                      Download admit card
                    </MenuItem>
                  )}
                  {exemptable &&
                    (r.exemption ? (
                      <MenuItem
                        icon={<ShieldOff />}
                        danger
                        onClick={() => {
                          close();
                          void unexempt(r);
                        }}
                      >
                        Remove exemption
                      </MenuItem>
                    ) : (
                      <MenuItem
                        icon={<ShieldCheck />}
                        onClick={() => {
                          close();
                          setExempting(r);
                        }}
                      >
                        Allow to sit the exam…
                      </MenuItem>
                    ))}
                </>
              )}
            </Menu>
          </div>
        );
      }
    }
  ];

  if (eligibility.error) return <ErrorState error={eligibility.error} onRetry={() => void eligibility.refetch()} />;
  if (!data) return <SkeletonBlock lines={8} />;
  if (!data.sections.length)
    return (
      <Card>
        <EmptyState icon={<FileBadge />} title="No papers yet" message="Add the exam's papers first: admit cards list each section's date sheet." />
      </Card>
    );

  const t = data.totals;
  return (
    <div className="stack">
      <Alert tone="info" action={<Link to={EXAM_ELIGIBILITY_PAGE}>Eligibility rules</Link>}>
        {rulesSentence(data.policy, money)} Attendance counts up to {formatDate(data.attendanceThrough)}; fees overdue on {formatDate(data.duesAsOf)}. {t.eligible} of {t.students} students are
        eligible{t.exempted ? ` (${t.exempted} exempted)` : ""}.
      </Alert>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Section"
            className="select-sm"
            value={sectionId}
            onChange={ev => setSectionId(ev.target.value)}
            placeholder="All sections"
            options={data.sections.map(s => ({ value: s.section.id, label: s.section.name }))}
          />
          <div style={{ flex: 1 }} />
          {sectionId && issuedHere > 0 && (
            <Button icon={<Download />} onClick={() => void download(() => downloadSectionAdmitCards(exam.id, sectionId))}>
              Download {sectionName}'s cards
            </Button>
          )}
          {canGenerate && (
            <Button variant="primary" icon={<FileBadge />} loading={busy} disabled={!rows.length} onClick={() => void generate()}>
              {sectionName ? `Generate for ${sectionName}` : "Generate admit cards"}
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.studentId}
          loading={cards.isLoading}
          error={cards.error}
          onRetry={() => void cards.refetch()}
          empty={<EmptyState icon={<FileBadge />} title="No students" message="Nobody is enrolled in the sections sitting this exam." />}
        />
      </Card>
      <ExemptDialog examId={exam.id} examName={exam.examName} row={exempting} onClose={() => setExempting(null)} onDone={refresh} />
    </div>
  );
}

/* Allow one student to sit the exam despite the rules, with the reason kept */
function ExemptDialog({ examId, examName, row, onClose, onDone }: { examId: string; examName: string; row: Row | null; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };

  const save = async () => {
    if (!row) return;
    if (!reason.trim()) {
      setError("Give the reason, e.g. a medical certificate or a fee arrangement");
      return;
    }
    setSaving(true);
    try {
      const res = await exemptStudent({ examId, studentId: row.studentId, reason: reason.trim() });
      await onDone();
      toast.success(`${res.message}. Generate the admit cards to issue theirs.`);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!row}
      onClose={close}
      title={row ? `Allow ${fullName(row)} to sit ${examName}?` : ""}
      footerStatus={error && <span className="ac-short">{error}</span>}
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Allow
          </Button>
        </>
      }
    >
      <div className="stack">
        {row && <p style={{ margin: 0 }}>{row.reasons.join(". ")}.</p>}
        <Textarea label="Reason" required rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} hint="Kept with the exemption" />
      </div>
    </Dialog>
  );
}
