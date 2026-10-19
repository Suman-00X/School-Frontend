import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* Read-only records of a student kept by other modules (files, finance, academics) */

/* ---- files (FL-01 embedded) ---- */

export type FileCategory = "PHOTO" | "DOCUMENT";

export type StoredFile = {
  id: string;
  ownerType: string;
  ownerId: string;
  category: FileCategory;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  description?: string;
  createdAt: string;
};

export type DownloadLink = { url: string; fileName: string; contentType: string; expiresAt: string };

const IMAGES = ["image/jpeg", "image/png", "image/webp"];
const OFFICE = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv"
];

/* The backend's CATEGORY_RULES (files module) */
export const FILE_RULES: Record<FileCategory, { accept: string; maxBytes: number; hint: string }> = {
  PHOTO: { accept: IMAGES.join(","), maxBytes: 5 * 1024 * 1024, hint: "JPEG, PNG or WebP, up to 5 MB" },
  DOCUMENT: {
    accept: [...OFFICE, ...IMAGES, ".csv", ".txt"].join(","),
    maxBytes: 10 * 1024 * 1024,
    hint: "PDF, Word, Excel, PowerPoint, text, CSV or images, up to 10 MB"
  }
};

/* Every file of the student, newest first (the list can't filter by category: gap) */
export const useStudentFiles = (studentId: string, enabled = true) =>
  useApiGet<StoredFile[]>("/files", { ownerType: "STUDENT", ownerId: studentId, limit: 100 }, { enabled });

export const uploadStudentFile = ({ studentId, file, category, description }: { studentId: string; file: File; category: FileCategory; description: string }) => {
  const form = new FormData();
  form.append("ownerType", "STUDENT");
  form.append("ownerId", studentId);
  form.append("category", category);
  if (description.trim()) form.append("description", description.trim());
  form.append("file", file);
  return api.upload<StoredFile>("/files", form);
};

export const deleteFile = (fileId: string) => api.delete<null>(`/files/${fileId}`);

export const getDownloadLink = async (fileId: string) => (await api.get<DownloadLink>(`/files/${fileId}/download-url`)).data;

/* A signed link for showing an image; refreshed well before its 15 minutes run out */
export const useFileLink = (fileId: string | null | undefined) =>
  useQuery({
    queryKey: ["/files", fileId, "download-url"],
    enabled: !!fileId,
    staleTime: 10 * 60_000,
    refetchInterval: 12 * 60_000,
    queryFn: () => getDownloadLink(fileId!)
  });

/* ---- finance statement (FI-11) ---- */

export type StatementInvoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
};

export type StatementPayment = {
  id: string;
  receiptNumber: string | null;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type StatementRefund = {
  id: string;
  refundNumber: string | null;
  amount: number;
  status: string;
  reason: string | null;
  createdAt: string;
};

export type Statement = {
  studentId: string;
  academicYearId: string;
  installmentPlan: { id: string; name: string; installmentCount: number } | null;
  concessions: { grantId: string; name: string; amount: number }[];
  totals: { gross: number; concessions: number; lateFees: number; billed: number; paid: number; refunded: number; balance: number; overdue: number };
  credit: { balance: number };
  invoices: StatementInvoice[];
  payments: StatementPayment[];
  refunds: StatementRefund[];
};

export const useStatement = (studentId: string, academicYearId: string) =>
  useApiGet<Statement>(`/finance/students/${studentId}/statement`, { academicYearId: academicYearId || undefined });

/* ---- attendance ---- */

export type AttendanceSummary = {
  from: string;
  to: string;
  mode: string;
  workingDays: number;
  marked: number;
  unmarked: number;
  counts: Record<"PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED", number>;
  attendedDays: number;
  countableDays: number;
  dayPercentage: number | null;
  periods: { held: number; attended: number; excused: number; percentage: number | null } | null;
  subjects: { subjectId: string; name: string; held: number; attended: number; excused: number; percentage: number | null }[] | null;
  basis: "DAYS" | "PERIODS";
  percentage: number | null;
};

export const useStudentAttendance = (studentId: string, from: string, to: string) =>
  useApiGet<AttendanceSummary>(`/academics/attendance/students/${studentId}`, { from: from || undefined, to: to || undefined });

/* ---- report cards ---- */

export type StudentReport = {
  kind: string;
  exam: { id: string; examName: string; examType: string; startDate: string | null; endDate: string | null; resultsPublishedAt: string | null };
  totalObtained: number | null;
  totalMax: number | null;
  percentage: number | null;
  grade: string | null;
  result: string | null;
  rank: number | null;
};

export type StudentReportCards = {
  student: { id: string; rollNumber: string; section: { id: string; name: string } };
  academicYearId: string;
  reports: StudentReport[];
};

/* Current year unless the header picks another; 404 when not enrolled that year */
export const useReportCards = (studentId: string, enabled = true) =>
  useApiGet<StudentReportCards>(`/academics/report-cards/students/${studentId}`, undefined, { enabled });

export const downloadReportCard = (studentId: string, examId: string) =>
  api.download(`/academics/report-cards/students/${studentId}/pdf`, { examId }, "report-card.pdf");
