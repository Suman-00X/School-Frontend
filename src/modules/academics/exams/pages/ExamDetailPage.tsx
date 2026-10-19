/* AC-13 · Exams and papers: one exam, its papers by section and its date sheet */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, FileSpreadsheet, MoreHorizontal, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  Page,
  Select,
  SkeletonBlock,
  useConfirm,
  useTabParam,
  useToast,
  type Column,
  type TabItem
} from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useSectionOptions, sectionTitle } from "../../shared/components/SectionSelect";
import { useTeachingSections } from "../../marks/api/marks";
import {
  componentLabel,
  deletePaper,
  EXAMS_PATH,
  EXAM_TYPE_LABELS,
  marksLabel,
  papersPath,
  timeRange,
  useExam,
  useExamPapers,
  type Exam,
  type ExamPaper
} from "../api/exams";
import { useGradeScales } from "../api/grading";
import { ExamDrawer } from "../components/ExamDrawer";
import { PaperDrawer } from "../components/PaperDrawer";
import { ResultsBadge } from "../components/ExamBits";
import { examDates } from "../utils/dates";

const marksLink = (p: ExamPaper) => `/academics/marks?examId=${p.examId}&sectionId=${p.sectionId}&paperId=${p.id}`;

export default function ExamDetailPage() {
  const { examId = "" } = useParams();
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const exam = useExam(examId);
  const [editing, setEditing] = useState(false);

  const tabs: TabItem[] = [
    { id: "papers", label: "Papers" },
    { id: "datesheet", label: "Date sheet" }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const e = exam.data;
  const header = (
    <DrillHeader
      back={EXAMS_PATH}
      backLabel="Back to exams"
      title={<span className="exam-drill-title">{e?.examName ?? ""}</span>}
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (exam.error)
    return (
      <Page>
        {header}
        <ErrorState error={exam.error} onRetry={() => void exam.refetch()} />
      </Page>
    );

  const canEdit = can("academics.exams.update") && !readOnly;
  return (
    <Page>
      {header}
      <ExamHeaderCard exam={e} onEdit={canEdit ? () => setEditing(true) : undefined} />
      {!e ? <SkeletonBlock lines={8} /> : tab === "papers" ? <PapersTab exam={e} /> : <DateSheetTab exam={e} />}
      {e && <ExamDrawer open={editing} exam={e} onClose={() => setEditing(false)} />}
    </Page>
  );
}

function ExamHeaderCard({ exam, onEdit }: { exam: Exam | undefined; onEdit?: () => void }) {
  const { can } = useAuth();
  const scales = useGradeScales();
  const scaleName = exam?.gradeScaleId ? scales.byId.get(exam.gradeScaleId)?.name : null;
  return (
    <Card>
      <div className="row-between" style={{ gap: 16, flexWrap: "wrap" }}>
        <div className="stack-sm" style={{ minWidth: 0, gap: 6 }}>
          <div className="row" style={{ gap: 8, minHeight: 22 }}>
            {exam ? (
              <>
                {exam.examType && <Badge tone={exam.examType === "FINAL" ? "primary" : "neutral"}>{EXAM_TYPE_LABELS[exam.examType]}</Badge>}
                <ResultsBadge exam={exam} />
              </>
            ) : (
              <span className="skeleton" style={{ display: "inline-block", width: 180, height: 14 }} />
            )}
          </div>
          <div className="row small muted" style={{ gap: 14, minHeight: 20 }}>
            {exam ? (
              <>
                <span className="row" style={{ gap: 4 }}>
                  <CalendarDays size={14} /> {examDates(exam) || "Dates not set"}
                </span>
                <span>Grade scale: {exam.gradeScaleId ? (scaleName ?? "—") : "the result policy's"}</span>
                {exam.description && (
                  <span className="exam-desc" title={exam.description}>
                    {exam.description}
                  </span>
                )}
              </>
            ) : (
              <span className="skeleton" style={{ display: "inline-block", width: 240, height: 14 }} />
            )}
          </div>
        </div>
        <div className="row">
          {(can("academics.reportCards.read") || can("academics.resultPublications.read")) && (
            <ButtonLink icon={<FileSpreadsheet />} to={exam ? `/academics/results?examId=${exam.id}` : "#"}>
              Results
            </ButtonLink>
          )}
          {onEdit && (
            <Button icon={<Pencil />} disabled={!exam} onClick={onEdit}>
              Edit exam
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function PapersTab({ exam }: { exam: Exam }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { readOnly } = useAcademicYear();
  const [sectionId, setSectionId] = useState("");
  const papers = useExamPapers(exam.id);
  const { byId: sectionsById, options: sectionOptions } = useSectionOptions();
  const teaching = useTeachingSections();
  const [drawer, setDrawer] = useState<{
    paper: ExamPaper | null;
    sectionId?: string;
  } | null>(null);
  const canManage = can("academics.exams.managePapers") && !readOnly;
  const canRecord = can("academics.marks.record") && !readOnly;

  /* Sections in class order, each with its papers by display code */
  const groups = useMemo(() => {
    const bySection = new Map<string, ExamPaper[]>();
    for (const p of papers.data ?? []) {
      if (sectionId && p.sectionId !== sectionId) continue;
      if (!bySection.has(p.sectionId)) bySection.set(p.sectionId, []);
      bySection.get(p.sectionId)!.push(p);
    }
    const order = (id: string) => {
      const s = sectionsById.get(id);
      return s ? `${String(s.class?.classOrder ?? 0).padStart(3, "0")}${s.sectionName}` : `zzz${id}`;
    };
    return [...bySection.entries()]
      .sort((a, b) => order(a[0]).localeCompare(order(b[0])))
      .map(([id, rows]) => ({
        sectionId: id,
        papers: rows.sort((a, b) => a.displayCode.localeCompare(b.displayCode))
      }));
  }, [papers.data, sectionId, sectionsById]);

  const sectionName = (id: string, fallback: string) => {
    const s = sectionsById.get(id);
    return s ? sectionTitle(s) : `Section ${fallback}`;
  };

  const remove = async (p: ExamPaper) => {
    const ok = await confirm({
      title: `Remove ${p.displayCode}?`,
      message: `${p.subject.subjectName}${p.component ? ` (${componentLabel(p.component).toLowerCase()})` : ""} is taken off ${exam.examName} for ${sectionName(p.sectionId, p.section.sectionName)}. A paper with recorded marks can't be removed.`,
      confirmLabel: "Remove paper"
    });
    if (!ok) return;
    try {
      const res = await deletePaper({ examId: exam.id, paperId: p.id });
      await qc.invalidateQueries({
        predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(papersPath(exam.id))
      });
      toast.success(res.message || `${p.displayCode} removed`);
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<ExamPaper>[] = [
    {
      key: "displayCode",
      header: "Code",
      width: 190,
      render: p => <span className="mono small">{p.displayCode}</span>
    },
    {
      key: "subject",
      header: "Subject",
      render: p => (
        <span>
          {p.subject.subjectName}
          {p.component && <span className="muted"> · {componentLabel(p.component)}</span>}
        </span>
      )
    },
    {
      key: "date",
      header: "Date",
      render: p => (p.examDate ? <span className="nowrap">{formatDate(p.examDate)}</span> : <span className="muted">Not set</span>)
    },
    {
      key: "time",
      header: "Time",
      render: p => <span className="nowrap">{timeRange(p) || <span className="muted">—</span>}</span>
    },
    {
      key: "room",
      header: "Room",
      render: p => p.room ?? <span className="muted">—</span>
    },
    {
      key: "marks",
      header: "Max (pass)",
      align: "right",
      render: p => (p.gradingType === "GRADE" ? <Badge>Grade only</Badge> : marksLabel(p))
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 150,
      render: p => {
        const mark = canRecord && teaching.canMark(p.sectionId, p.subjectId);
        if (!mark && !canManage) return null;
        return (
          <div className="row-actions" onClick={ev => ev.stopPropagation()}>
            {mark && (
              <ButtonLink size="sm" variant="ghost" icon={<PenLine />} to={marksLink(p)}>
                Marks
              </ButtonLink>
            )}
            {canManage && (
              <Menu
                trigger={toggle => (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<MoreHorizontal />}
                    onClick={toggle}
                    aria-label={`More actions for ${p.displayCode}`}
                    title="More"
                  />
                )}
              >
                {close => (
                  <>
                    <MenuItem
                      icon={<Pencil />}
                      onClick={() => {
                        close();
                        setDrawer({ paper: p });
                      }}
                    >
                      Edit date, time and marks
                    </MenuItem>
                    <MenuItem
                      icon={<Trash2 />}
                      danger
                      onClick={() => {
                        close();
                        void remove(p);
                      }}
                    >
                      Remove paper
                    </MenuItem>
                  </>
                )}
              </Menu>
            )}
          </div>
        );
      }
    }
  ];

  const shownSections = new Set((papers.data ?? []).map(p => p.sectionId));
  const filterOptions = sectionOptions.filter(o => shownSections.has(o.value));
  const withActions = canManage || canRecord;

  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Section"
            className="select-sm"
            value={sectionId}
            onChange={ev => setSectionId(ev.target.value)}
            placeholder="All sections"
            options={filterOptions}
          />
          <div style={{ flex: 1 }} />
          {canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ paper: null, sectionId: sectionId || undefined })}>
              Add paper
            </Button>
          )}
        </div>
        {papers.error ? (
          <ErrorState error={papers.error} onRetry={() => void papers.refetch()} />
        ) : papers.isLoading ? (
          <SkeletonBlock lines={6} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet />}
            title={sectionId ? "This section has no papers in this exam." : "No papers yet"}
            message={
              sectionId
                ? undefined
                : canManage
                  ? "Add a paper for each subject a section sits: its date, time, room and marks."
                  : teaching.teacher
                    ? "None of your sections sits this exam yet."
                    : "Papers appear here once they are added."
            }
            actions={
              canManage &&
              !sectionId && (
                <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ paper: null })}>
                  Add paper
                </Button>
              )
            }
          />
        ) : null}
      </Card>
      {groups.map(g => (
        <Card
          key={g.sectionId}
          flush
          title={sectionName(g.sectionId, g.papers[0].section.sectionName)}
          subtitle={`${g.papers.length} paper${g.papers.length === 1 ? "" : "s"}`}
          actions={
            canManage && (
              <Button size="sm" icon={<Plus />} onClick={() => setDrawer({ paper: null, sectionId: g.sectionId })}>
                Add paper
              </Button>
            )
          }
        >
          <DataTable columns={columns.filter(c => withActions || c.key !== "actions")} rows={g.papers} rowKey={p => p.id} />
        </Card>
      ))}
      {drawer && <PaperDrawer open exam={exam} paper={drawer.paper} defaultSectionId={drawer.sectionId} onClose={() => setDrawer(null)} />}
    </div>
  );
}

/* Days down the side, sections across: which paper each section sits on which day */
function DateSheetTab({ exam }: { exam: Exam }) {
  const papers = useExamPapers(exam.id);
  const { byId: sectionsById } = useSectionOptions();

  const { days, sections, cell } = useMemo(() => {
    const rows = papers.data ?? [];
    const sectionIds = [...new Set(rows.map(p => p.sectionId))].sort((a, b) => {
      const sa = sectionsById.get(a);
      const sb = sectionsById.get(b);
      return (sa?.class?.classOrder ?? 0) - (sb?.class?.classOrder ?? 0) || (sa?.sectionName ?? "").localeCompare(sb?.sectionName ?? "");
    });
    const dayKeys = [...new Set(rows.map(p => p.examDate ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    const map = new Map<string, ExamPaper[]>();
    for (const p of rows) {
      const k = `${p.examDate ?? ""}|${p.sectionId}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    for (const list of map.values()) list.sort((a, b) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")));
    return {
      days: dayKeys,
      sections: sectionIds,
      cell: (day: string, sid: string) => map.get(`${day}|${sid}`) ?? []
    };
  }, [papers.data, sectionsById]);

  if (papers.error) return <ErrorState error={papers.error} onRetry={() => void papers.refetch()} />;
  if (papers.isLoading) return <SkeletonBlock lines={6} />;
  if (!days.length)
    return (
      <Card>
        <EmptyState icon={<CalendarDays />} title="No papers to schedule yet" message="The date sheet fills in as papers are given a date." />
      </Card>
    );

  const weekday = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short"
    });
  return (
    <Card flush>
      <div className="table-wrap">
        <table className="table datesheet">
          <thead>
            <tr>
              <th className="datesheet-day">Date</th>
              {sections.map(sid => {
                const s = sectionsById.get(sid);
                return <th key={sid}>{s ? sectionTitle(s) : "Section"}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day || "none"}>
                <td className="datesheet-day">
                  {day ? (
                    <>
                      <strong className="nowrap">{formatDate(day)}</strong>
                      <div className="small muted">{weekday(day)}</div>
                    </>
                  ) : (
                    <span className="muted">Not scheduled</span>
                  )}
                </td>
                {sections.map(sid => (
                  <td key={sid}>
                    {cell(day, sid).map(p => (
                      <div key={p.id} className="datesheet-paper" title={p.displayCode}>
                        <span>
                          {p.subject.subjectName}
                          {p.component ? ` · ${componentLabel(p.component)}` : ""}
                        </span>
                        <span className="small muted">{[timeRange(p), p.room].filter(Boolean).join(" · ") || "Time not set"}</span>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
