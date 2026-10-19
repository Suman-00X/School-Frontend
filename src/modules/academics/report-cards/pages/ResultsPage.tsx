/* AC-15 · Report cards and result publishing: an exam's (or an assessment scheme's) live results
   by section, a student's report card, publishing with versions, changes since publishing, policy
   previews and the published copies */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSpreadsheet, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";
import { Badge, Button, Card, EmptyState, PageHeader, Select, Tabs, type TabItem } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useSectionOptions, sectionTitle } from "../../shared/components/SectionSelect";
import { fetchAll, useAllExams, useExamPapers } from "../../exams/api/exams";
import { useTeachingSections } from "../../marks/api/marks";
import { sourcePaths, sourcePerms, type Publication, type Source, type SourceKind } from "../api/reportCards";
import { ChangesPanel } from "../components/ChangesPanel";
import { ClassSheet } from "../components/ClassSheet";
import { PreviewPanel } from "../components/PreviewPanel";
import { PublicationPanel } from "../components/PublicationPanel";
import { SnapshotsPanel } from "../components/SnapshotsPanel";
import { StudentPanel } from "../components/StudentPanel";
import "../results.css";

type Scheme = {
  id: string;
  name: string;
  description: string | null;
  policyId: string | null;
  resultsPublishedAt: string | null;
  exams: { examId: string; weight: number; exam: { id: string; examName: string } }[];
};

const SCHEMES_PATH = "/academics/assessment-schemes";

export default function ResultsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  const get = (k: string) => search.get(k) ?? "";
  const setQuery = (patch: Record<string, string>) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        next.delete("page");
        return next;
      },
      { replace: true }
    );

  const examSide = can("academics.reportCards.read") || can("academics.resultPublications.read");
  const schemeSide = can("academics.assessmentSchemes.read");
  const kind: SourceKind = (get("source") === "scheme" && schemeSide) || !examSide ? "scheme" : "exam";
  const examId = get("examId");
  const schemeId = get("schemeId");
  const sectionId = get("sectionId");
  const studentId = get("studentId");

  const { exams, isLoading: examsLoading } = useAllExams(examSide);
  const schemes = useQuery({
    queryKey: [SCHEMES_PATH, { all: true }],
    enabled: schemeSide,
    queryFn: () => fetchAll<Scheme>(SCHEMES_PATH)
  });
  const exam = exams.find(e => e.id === examId);
  const scheme = (schemes.data ?? []).find(s => s.id === schemeId);
  const source: Source | null =
    kind === "exam"
      ? exam
        ? { kind, id: exam.id, name: exam.examName, publishedAt: exam.resultsPublishedAt }
        : null
      : scheme
        ? { kind, id: scheme.id, name: scheme.name, publishedAt: scheme.resultsPublishedAt }
        : null;
  const perms = sourcePerms(kind, can);

  /* Sections: those that sit the exam (any section for a scheme); a teacher only the ones they are class teacher of */
  const teaching = useTeachingSections();
  const { options: allSections, byId: sectionsById } = useSectionOptions();
  const papers = useExamPapers(kind === "exam" ? examId || null : null);
  const sectionOptions = useMemo(() => {
    const sitting = kind === "exam" ? new Set((papers.data ?? []).map(p => p.sectionId)) : null;
    return allSections.filter(o => (!sitting || sitting.has(o.value)) && teaching.isClassTeacher(o.value));
  }, [kind, papers.data, allSections, teaching]);
  const sectionCount = kind === "exam" && papers.data ? new Set(papers.data.map(p => p.sectionId)).size : null;

  const versions = useApiList<Publication>(source ? sourcePaths(source).versions : "", { limit: 100 }, { enabled: !!source && perms.versions });
  const latest = versions.rows?.[0];

  const tabs: TabItem[] = [
    { id: "sheet", label: "Class sheet", hidden: !perms.sheet },
    { id: "student", label: "Student", hidden: !perms.sheet },
    { id: "publication", label: "Publication", hidden: !perms.versions },
    { id: "changes", label: "Changes since publishing", hidden: !perms.versions },
    { id: "preview", label: "Preview rules", hidden: !perms.preview },
    { id: "snapshots", label: "Published copies", hidden: !perms.snapshots }
  ];
  const visible = tabs.filter(t => !t.hidden);
  const tab = visible.some(t => t.id === get("tab")) ? get("tab") : (visible[0]?.id ?? "");

  const status = !source ? null : source.publishedAt ? (
    <span title={`Published ${formatDateTime(source.publishedAt)}`}>
      <Badge tone="success" dot>
        Published{latest?.status === "CURRENT" ? ` v${latest.version}` : ""}
      </Badge>
    </span>
  ) : latest ? (
    <Badge tone="warning" dot>
      Withdrawn
    </Badge>
  ) : (
    <Badge>Not published</Badge>
  );

  const pickSource = (k: SourceKind) => setQuery({ source: k === "exam" ? "" : "scheme", studentId: "", version: "" });
  const needsSection = tab === "sheet" || tab === "student";
  const noClassTeacher = teaching.teacher && !teaching.isLoading && !teaching.rows.some(r => r.isClassTeacher);

  const body = () => {
    if (noClassTeacher)
      return (
        <Card>
          <EmptyState
            icon={<Users />}
            title="Report cards are for class teachers"
            message="You see a section's results here once you are its class teacher."
          />
        </Card>
      );
    if (!source)
      return (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet />}
            title={kind === "exam" ? "Pick an exam" : "Pick an assessment scheme"}
            message={
              kind === "exam"
                ? examsLoading
                  ? "Loading exams…"
                  : exams.length
                    ? "Then a section to see its class sheet."
                    : "No exams in this year yet."
                : schemes.isLoading
                  ? "Loading schemes…"
                  : (schemes.data ?? []).length
                    ? "A scheme combines exams with weights into a term or annual result."
                    : "No assessment schemes yet: they are set up under Setup › Grading."
            }
          />
        </Card>
      );
    if (needsSection && !sectionId)
      return (
        <Card>
          <EmptyState
            icon={<Users />}
            title="Pick a section"
            message={
              sectionOptions.length
                ? `${sectionOptions.length} section${sectionOptions.length === 1 ? "" : "s"} to choose from.`
                : "No section sits this exam yet."
            }
          />
        </Card>
      );
    switch (tab) {
      case "sheet":
        return <ClassSheet source={source} sectionId={sectionId} onOpenStudent={s => setQuery({ tab: "student", studentId: s.studentId })} />;
      case "student":
        return (
          <StudentPanel
            source={source}
            sectionId={sectionId}
            studentId={studentId}
            onPick={id => setQuery({ studentId: id })}
            onSnapshots={perms.snapshots ? id => setQuery({ tab: "snapshots", studentId: id }) : undefined}
          />
        );
      case "publication":
        return <PublicationPanel source={source} canPublish={perms.publish} sectionCount={sectionCount} versions={versions} />;
      case "changes":
        return <ChangesPanel source={source} sectionId={sectionId} versions={versions.rows ?? []} />;
      case "preview":
        return (
          <PreviewPanel key={`${source.id}:${sectionId}`} source={source} sectionId={sectionId} initialPolicyId={get("policyId") || undefined} />
        );
      case "snapshots":
        return <SnapshotsPanel source={source} sectionId={sectionId} versions={versions.rows ?? []} />;
      default:
        return null;
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Report cards & publishing"
        subtitle="Live results from the marks, the report cards families see, and every published version."
      />
      <Card flush>
        <div className="filter-bar">
          {examSide && schemeSide && (
            <div className="field">
              <span className="field-label">Results of</span>
              <div className="rc-toggle" role="group" aria-label="Results of">
                <Button size="sm" variant={kind === "exam" ? "primary" : "default"} aria-pressed={kind === "exam"} onClick={() => pickSource("exam")}>
                  An exam
                </Button>
                <Button
                  size="sm"
                  variant={kind === "scheme" ? "primary" : "default"}
                  aria-pressed={kind === "scheme"}
                  onClick={() => pickSource("scheme")}
                >
                  A term or year
                </Button>
              </div>
            </div>
          )}
          {kind === "exam" ? (
            <Select
              label="Exam"
              className="select-sm"
              value={examId}
              required
              placeholder={examsLoading ? "Loading exams…" : "Pick an exam"}
              options={exams.map(e => ({ value: e.id, label: e.examName, description: e.resultsPublishedAt ? "Published" : undefined }))}
              onChange={e => setQuery({ examId: e.target.value, studentId: "", version: "" })}
            />
          ) : (
            <Select
              label="Assessment scheme"
              className="select-sm"
              value={schemeId}
              required
              placeholder={schemes.isLoading ? "Loading schemes…" : "Pick a scheme"}
              options={(schemes.data ?? []).map(s => ({
                value: s.id,
                label: s.name,
                description: s.exams.map(x => `${x.exam?.examName ?? "Exam"} ${x.weight}%`).join(" + ")
              }))}
              onChange={e => setQuery({ schemeId: e.target.value, studentId: "", version: "" })}
            />
          )}
          <Select
            label="Section"
            className="select-sm"
            value={sectionId}
            placeholder={needsSection ? "Pick a section" : "All sections"}
            options={
              sectionOptions.length || !sectionId
                ? sectionOptions
                : [{ value: sectionId, label: sectionsById.get(sectionId) ? sectionTitle(sectionsById.get(sectionId)!) : "Section" }]
            }
            onChange={e => setQuery({ sectionId: e.target.value, studentId: "" })}
          />
          <div className="rc-status">{status}</div>
        </div>
        <div className="rc-tabs">
          <Tabs tabs={tabs} value={tab} onChange={id => setQuery({ tab: id === visible[0]?.id ? "" : id })} />
        </div>
      </Card>
      {body()}
    </div>
  );
}
