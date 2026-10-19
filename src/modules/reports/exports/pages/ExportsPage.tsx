import { useState } from "react";
import { CalendarCheck, ClipboardList, FileWarning, Receipt, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { EmptyState, Page, Select, TextInput } from "@/common/ui";
import { SectionSelect } from "@/modules/academics";
import { PageIntro } from "../../shared/components/PageIntro";
import { examOption, useExams } from "../../shared/api/exams";
import { ExportCard, useExportDownload, type ExportFormat } from "../components/ExportCard";
import "../components/exports.css";

const MAX_DAYS = 62;
const days = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;

/* The year line on the year-scoped cards: they follow the header's year switcher */
function YearNote() {
  const { selected } = useAcademicYear();
  return (
    <p className="small muted span-2" style={{ minHeight: 19 }}>
      {selected ? `Year ${selected.yearName}. Pick another year in the header to export it.` : "The current academic year."}
    </p>
  );
}

/* Date checks before the request; the server's own errors land in the same fields */
function rangeErrors(from: string, to: string, max?: number) {
  const e: Record<string, string> = {};
  if (!from) e.from = "Pick the first day";
  if (!to) e.to = "Pick the last day";
  if (from && to && to < from) e.to = "Must be on or after the first day";
  else if (max && from && to && days(from, to) > max) e.to = `At most ${max} days at a time`;
  return e;
}

function StudentsExport() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const dl = useExportDownload("/reports/exports/students", "students.xlsx");
  return (
    <ExportCard
      title="Students"
      icon={<Users />}
      contents="Class, section, roll no., student code, admission no., name, gender, date of birth, contact details, status and parents."
      format={format}
      onFormat={setFormat}
      busy={dl.busy}
      error={dl.error}
      onDownload={() => void dl.run({ format })}
    >
      <YearNote />
    </ExportCard>
  );
}

function AttendanceExport() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dl = useExportDownload("/reports/exports/attendance", "attendance.xlsx");
  const err = (k: string) => errors[k] || dl.fieldErrors[k] || undefined;
  const download = () => {
    const e = { ...rangeErrors(from, to, MAX_DAYS), ...(sectionId ? {} : { sectionId: "Pick a section" }) };
    setErrors(e);
    if (Object.keys(e).length) return;
    void dl.run({ format, sectionId, from, to });
  };
  const change = (k: string, set: (v: string) => void) => (v: string) => {
    set(v);
    setErrors(x => ({ ...x, [k]: "" }));
    dl.clear(k);
  };
  return (
    <ExportCard
      title="Attendance register"
      icon={<CalendarCheck />}
      contents="One sheet for the section: roll no., student, then a column per day (or per session or period, by attendance mode)."
      format={format}
      onFormat={setFormat}
      busy={dl.busy}
      error={dl.error}
      onDownload={download}
    >
      <div className="span-2">
        <SectionSelect value={sectionId} required onChange={e => change("sectionId", setSectionId)(e.target.value)} error={err("sectionId")} />
      </div>
      <TextInput label="From" type="date" required value={from} max={to || undefined} onChange={e => change("from", setFrom)(e.target.value)} error={err("from")} />
      <TextInput label="To" type="date" required value={to} min={from || undefined} onChange={e => change("to", setTo)(e.target.value)} error={err("to")} hint={`Up to ${MAX_DAYS} days`} />
    </ExportCard>
  );
}

function FeeCollectionsExport() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dl = useExportDownload("/reports/exports/fee-collections", "fee-collections.xlsx");
  const err = (k: string) => errors[k] || dl.fieldErrors[k] || undefined;
  const download = () => {
    const e = rangeErrors(from, to);
    setErrors(e);
    if (Object.keys(e).length) return;
    void dl.run({ format, from, to });
  };
  return (
    <ExportCard
      title="Fee collections"
      icon={<Receipt />}
      contents="Every payment received in the range: date, receipt, invoice, admission no., student, method, reference, amount and any credit kept."
      format={format}
      onFormat={setFormat}
      busy={dl.busy}
      error={dl.error}
      onDownload={download}
    >
      <TextInput
        label="From"
        type="date"
        required
        value={from}
        max={to || undefined}
        onChange={e => {
          setFrom(e.target.value);
          setErrors(x => ({ ...x, from: "" }));
          dl.clear("from");
        }}
        error={err("from")}
      />
      <TextInput
        label="To"
        type="date"
        required
        value={to}
        min={from || undefined}
        onChange={e => {
          setTo(e.target.value);
          setErrors(x => ({ ...x, to: "" }));
          dl.clear("to");
        }}
        error={err("to")}
      />
    </ExportCard>
  );
}

function FeeDefaultersExport() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const dl = useExportDownload("/reports/exports/fee-defaulters", "fee-defaulters.xlsx");
  return (
    <ExportCard
      title="Fee defaulters"
      icon={<FileWarning />}
      contents="Overdue balances as of today: class, admission no., name, invoices, oldest due date and the overdue amount."
      format={format}
      onFormat={setFormat}
      busy={dl.busy}
      error={dl.error}
      onDownload={() => void dl.run({ format })}
    >
      <YearNote />
    </ExportCard>
  );
}

function ResultsExport() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const exams = useExams();
  const dl = useExportDownload("/reports/exports/results", "results.xlsx");
  const err = (k: string) => errors[k] || dl.fieldErrors[k] || undefined;
  const download = () => {
    const e: Record<string, string> = {};
    if (!examId) e.examId = "Pick an exam";
    if (!sectionId) e.sectionId = "Pick a section";
    setErrors(e);
    if (Object.keys(e).length) return;
    void dl.run({ format, examId, sectionId });
  };
  return (
    <ExportCard
      title="Results"
      icon={<ClipboardList />}
      contents="One section's result sheet for one exam: roll no., student, a column per subject, total, %, grade, result and rank."
      format={format}
      onFormat={setFormat}
      busy={dl.busy}
      error={dl.error}
      onDownload={download}
    >
      <Select
        label="Exam"
        required
        value={examId}
        placeholder={exams.isLoading ? "Loading exams…" : "Pick an exam"}
        options={(exams.data ?? []).map(examOption)}
        onChange={e => {
          setExamId(e.target.value);
          setErrors(x => ({ ...x, examId: "" }));
          dl.clear("examId");
        }}
        error={err("examId")}
      />
      <SectionSelect
        value={sectionId}
        required
        onChange={e => {
          setSectionId(e.target.value);
          setErrors(x => ({ ...x, sectionId: "" }));
          dl.clear("sectionId");
        }}
        error={err("sectionId")}
      />
    </ExportCard>
  );
}

/* RP-02 · Exports: spreadsheet downloads, one card per export the person may use */
export default function ExportsPage() {
  const { can } = useAuth();
  const cards = [
    can("reports.exports.students") && <StudentsExport key="students" />,
    can("reports.exports.attendance") && <AttendanceExport key="attendance" />,
    can("reports.exports.fees") && <FeeCollectionsExport key="collections" />,
    can("reports.exports.fees") && <FeeDefaultersExport key="defaulters" />,
    can("reports.exports.results") && <ResultsExport key="results" />
  ].filter(Boolean);
  return (
    <Page>
      <PageIntro>Download school records as Excel or CSV. The file is built when you click Download.</PageIntro>
      {cards.length ? <div className="export-grid">{cards}</div> : <EmptyState title="No exports for your role" />}
    </Page>
  );
}
