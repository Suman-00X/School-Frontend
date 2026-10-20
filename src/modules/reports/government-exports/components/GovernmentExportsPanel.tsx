import { useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Landmark } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Alert, Button, Card, Checkbox, DataTable, EmptyState, ErrorState, RadioGroup, StatTile, StatTiles, useToast, type Column } from "@/common/ui";
import { GOV_EXPORTS_PATH, downloadApaar, downloadUdise, type ExportFormat, type Readiness } from "../api/governmentExports";

type Gap = Readiness["gaps"][number];

/* AC-15 UDISE+ / APAAR (when the NEP policy opts in): what is missing, and the files for
   the government portals, for the picked section or every section of the year */
export function GovernmentExportsPanel({
  sectionId,
  exam,
  udise,
  apaar
}: {
  sectionId: string;
  exam: { id: string; name: string } | null;
  udise: boolean;
  apaar: boolean;
}) {
  const toast = useToast();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [withResult, setWithResult] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const readiness = useApiGet<Readiness>(`${GOV_EXPORTS_PATH}/readiness`, { sectionId: sectionId || undefined });
  const r = readiness.data;
  const scope = sectionId ? "this section" : "every section";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };
  const q = { format, sectionId: sectionId || undefined };

  if (readiness.error) return <ErrorState error={readiness.error} onRetry={() => void readiness.refetch()} />;

  const gapColumns: Column<Gap>[] = [
    { key: "section", header: "Class", width: 90, render: g => <span className="nowrap">{g.section}</span> },
    { key: "roll", header: "Roll", width: 80, render: g => <span className="mono small nowrap">{g.rollNumber ?? "—"}</span> },
    { key: "name", header: "Student", render: g => <Link to={`/users/students/${g.studentId}`}>{g.name}</Link> },
    { key: "missing", header: "Missing", render: g => <span className="small">{g.missing.join(", ")}</span> }
  ];

  return (
    <div className="stack">
      <StatTiles>
        <StatTile label="Students" value={r?.students} hint={r ? `Enrolled in ${scope}, ${r.academicYear.yearName}` : undefined} loading={readiness.isLoading} />
        {udise && (
          <StatTile
            label="Ready for UDISE+"
            value={r ? `${r.ready.udise} / ${r.students}` : undefined}
            hint="Date of birth, gender, parents' names, mobile"
            meter={r && r.students ? Math.round((r.ready.udise / r.students) * 100) : null}
            meterTone="success"
            loading={readiness.isLoading}
          />
        )}
        {apaar && (
          <StatTile
            label="APAAR ids"
            value={r ? `${r.apaar.generated} / ${r.students}` : undefined}
            hint={r ? `${r.apaar.consentGiven} consented, id pending · ${r.apaar.consentPending} awaiting consent` : undefined}
            meter={r && r.students ? Math.round((r.apaar.generated / r.students) * 100) : null}
            loading={readiness.isLoading}
          />
        )}
      </StatTiles>

      <Card title="Download" subtitle={`For ${scope}${r?.udiseCode ? ` · UDISE code ${r.udiseCode}` : ""}. UDISE+ columns follow the Data Capture Format 2025-26 (Part B: field numbers and codes); APAAR columns follow the portal's mandatory fields. Aadhaar is not kept, so fill it in on the portal.`}>
        <div className="stack">
          <RadioGroup
            aria-label="File format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "xlsx", label: "Excel (.xlsx)" },
              { value: "csv", label: "CSV" }
            ]}
          />
          {udise && (
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Button
                variant="primary"
                icon={<FileDown />}
                loading={busy === "udise"}
                onClick={() => void run("udise", () => downloadUdise({ ...q, examId: exam && withResult ? exam.id : undefined }))}
              >
                UDISE+ student profile
              </Button>
              {exam && <Checkbox label={`Include the result of ${exam.name} and days attended (4.5)`} checked={withResult} onChange={e => setWithResult(e.target.checked)} />}
            </div>
          )}
          {apaar && (
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Button icon={<FileDown />} loading={busy === "apaar"} onClick={() => void run("apaar", () => downloadApaar(q))}>
                APAAR: all students
              </Button>
              <Button icon={<FileDown />} loading={busy === "pending"} onClick={() => void run("pending", () => downloadApaar({ ...q, pending: true }))}>
                APAAR: ids still to generate
              </Button>
            </div>
          )}
          {r && r.students > 0 && r.missing.some(m => m.key === "pen" && m.count > 0) && (
            <Alert tone="info">
              {r.missing.find(m => m.key === "pen")!.count} student(s) have no PEN yet. UDISE+ gives a PEN once the student's profile is uploaded; enter it on the student's profile afterwards.
            </Alert>
          )}
        </div>
      </Card>

      <Card flush title="To fix before uploading" subtitle="Students with details missing (first 100). Open a student to complete their profile.">
        <DataTable
          rows={r?.gaps}
          columns={gapColumns}
          rowKey={g => g.studentId}
          loading={readiness.isLoading}
          empty={<EmptyState icon={<Landmark />} title="Nothing missing" message="Every student has what the files need." />}
        />
      </Card>
    </div>
  );
}
