import { api } from "@/common/api";
import { studentPath } from "../../shared/api/students";

export type HomeworkStatus = "NOT_SUBMITTED" | "SUBMITTED" | "LATE" | "RETURNED" | "GRADED";

export type StoredFile = { id: string; fileName: string; contentType: string; size: number; createdAt?: string };

export type Submission = {
  id: string;
  content: string | null;
  submittedAt: string;
  isLate: boolean;
  status: "SUBMITTED" | "RETURNED" | "GRADED";
  marksAwarded: number | null;
  feedback: string | null;
  gradedAt: string | null;
  attachments?: StoredFile[];
};

export type Homework = {
  id: string;
  title: string;
  description: string | null;
  subject: { id: string; subjectName: string; subjectCode?: string } | null;
  assignedOn: string;
  dueDate: string;
  maxMarks: number | null;
  allowLateSubmission: boolean;
  myStatus: HomeworkStatus;
  mySubmission: Submission | null;
  attachments?: StoredFile[];
};

export const homeworkListPath = (studentId: string) => `${studentPath(studentId)}/homework`;
export const homeworkPath = (studentId: string, homeworkId: string) => `${homeworkListPath(studentId)}/${homeworkId}`;

export const homeworkFileLink = (studentId: string, homeworkId: string, fileId: string) =>
  api.get<{ url: string; fileName: string }>(`${homeworkPath(studentId, homeworkId)}/attachments/${fileId}/download-url`);

/* Multipart: content and/or one file. Only the student themselves can submit. */
export function submitHomework({ homeworkId, content, file }: { homeworkId: string; content: string; file: File | null }) {
  const form = new FormData();
  if (content.trim()) form.append("content", content.trim());
  if (file) form.append("file", file);
  return api.upload<Submission>(`/me/homework/${homeworkId}/submission`, form);
}

export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  LATE: "Submitted late",
  RETURNED: "Returned",
  GRADED: "Graded"
};
export const HOMEWORK_STATUS_TONES = { NOT_SUBMITTED: "neutral", SUBMITTED: "info", LATE: "warning", RETURNED: "warning", GRADED: "success" } as const;

/* What the API accepts for a submission (files module, ATTACHMENT): office files, text and images up to 10 MB */
export const SUBMISSION_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp";
export const SUBMISSION_MAX_BYTES = 10 * 1024 * 1024;
