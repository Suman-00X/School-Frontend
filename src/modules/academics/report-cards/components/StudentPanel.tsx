import { useState } from "react";
import { FileDown, History, Palette, UserRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Select, SkeletonBlock, useToast } from "@/common/ui";
import { downloadPdf, sourcePaths, studentFullName, type ResultSheet, type Source, type StudentCard } from "../api/reportCards";
import { ReportCardView } from "./ReportCardView";

/* AC-15 Student: one student's live report card for the source, with its PDF (printed from
   the school's report card format, edited in Certificates › Formats) */
export function StudentPanel({
  source,
  sectionId,
  studentId,
  onPick,
  onSnapshots
}: {
  source: Source;
  sectionId: string;
  studentId: string;
  onPick: (studentId: string) => void;
  onSnapshots?: (studentId: string) => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const sheetQ = sourcePaths(source).sheet(sectionId);
  const sheet = useApiGet<ResultSheet>(sheetQ.path, sheetQ.query);
  const { path, query } = sourcePaths(source).student(studentId);
  const card = useApiGet<StudentCard>(studentId ? path : null, query);
  const row = sheet.data?.students.find(s => s.studentId === studentId);
  const report = card.data?.report ?? card.data?.reports?.[0];

  const options = (sheet.data?.students ?? []).map(s => ({
    value: s.studentId,
    label: studentFullName(s),
    description: [s.rollNumber, s.enrollmentStatus === "LEFT" ? "left" : null].filter(Boolean).join(" · ") || undefined
  }));

  const pdf = async () => {
    setDownloading(true);
    try {
      await downloadPdf(source, studentId);
    } catch (err) {
      toast.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const picker = (
    <div className="filter-bar rc-inline-bar">
      <Select
        label="Student"
        className="select-sm"
        value={studentId}
        options={options}
        placeholder={sheet.isLoading ? "Loading students…" : "Pick a student"}
        required
        onChange={e => onPick(e.target.value)}
      />
    </div>
  );

  if (!studentId)
    return (
      <Card flush>
        {picker}
        <EmptyState icon={<UserRound />} title="Pick a student" message="Or click a row of the class sheet." />
      </Card>
    );

  return (
    <div className="stack">
      <Card flush>{picker}</Card>
      {card.error ? (
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      ) : !report ? (
        card.isLoading ? (
          <SkeletonBlock lines={8} />
        ) : (
          <Card>
            <EmptyState title={`No report card for ${source.name}`} message="This student sits none of its papers." />
          </Card>
        )
      ) : (
        <ReportCardView
          report={report}
          title={
            <span>
              {row ? studentFullName(row) : "Report card"}
              <span className="muted small" style={{ fontWeight: 400 }}>
                {" "}
                · {[card.data?.student.rollNumber, card.data?.student.section.name].filter(Boolean).join(" · ")} · live, as of now
              </span>
            </span>
          }
          actions={
            <>
              {onSnapshots && (
                <Button size="sm" icon={<History />} onClick={() => onSnapshots(studentId)}>
                  Published copies
                </Button>
              )}
              {can("academics.certificateFormats.read") && (
                <ButtonLink size="sm" icon={<Palette />} to="/academics/certificates?tab=formats&format=REPORT_CARD">
                  PDF format
                </ButtonLink>
              )}
              <Button size="sm" icon={<FileDown />} loading={downloading} onClick={() => void pdf()}>
                PDF
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
