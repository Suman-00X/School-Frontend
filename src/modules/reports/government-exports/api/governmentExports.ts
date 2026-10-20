import { api } from "@/common/api";

/* UDISE+ and APAAR student files (backend reports/government-exports), for schools whose NEP policy opts in */

export const GOV_EXPORTS_PATH = "/reports/government-exports";

export type Readiness = {
  academicYear: { id: string; yearName: string };
  udiseCode: string | null;
  udiseExport: boolean;
  apaarExport: boolean;
  students: number;
  ready: { udise: number; apaar: number };
  apaar: { generated: number; consentGiven: number; consentPending: number };
  missing: { key: string; label: string; count: number }[];
  gaps: { studentId: string; name: string; section: string; rollNumber: string | null; missing: string[] }[];
};

export type ExportFormat = "xlsx" | "csv";

export const downloadUdise = (q: { format: ExportFormat; sectionId?: string; examId?: string }) =>
  api.download(`${GOV_EXPORTS_PATH}/udise`, q, `udise-plus-students.${q.format}`);

export const downloadApaar = (q: { format: ExportFormat; sectionId?: string; pending?: boolean }) =>
  api.download(`${GOV_EXPORTS_PATH}/apaar`, q, `apaar-students.${q.format}`);
