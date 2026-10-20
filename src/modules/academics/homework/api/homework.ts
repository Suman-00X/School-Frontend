import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { fetchAll } from "../../shared/api/fetchAll";

/* GET /academics/homework rows (header's year) and GET /academics/homework/:homeworkId */
export type Homework = {
  id: string;
  academicYearId: string;
  sectionId: string;
  subjectId: string;
  assignedBy: string;
  teacherId: string | null;
  title: string;
  description: string | null;
  assignedOn: string;
  dueDate: string;
  /* null: feedback only, no marks */
  maxMarks: number | null;
  allowLateSubmission: boolean;
  subject: { id: string; subjectName: string; subjectCode: string } | null;
  /* List only */
  submissions?: { submitted: number; graded: number };
  /* Detail only */
  attachments?: StoredFile[];
  /* Detail only: the teacher-assessment bucket it counts toward (null: none) */
  assessment?: { id: string; bucketId: string; counts: boolean; bucket: { id: string; name: string; weight: number; scheme: { name: string } } | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredFile = { id: string; fileName: string; contentType: string; size: number; createdAt: string; uploadedBy: string | null };

export type HomeworkInput = {
  sectionId: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate: string;
  maxMarks?: number;
  allowLateSubmission: boolean;
  /* Counts toward a scheme bucket (needs maxMarks) */
  bucketId?: string;
};

export type SubmissionStatus = "NOT_SUBMITTED" | "SUBMITTED" | "LATE" | "GRADED" | "RETURNED";

export type Submission = {
  id: string;
  content: string | null;
  submittedAt: string;
  isLate: boolean;
  status: "SUBMITTED" | "GRADED" | "RETURNED";
  marksAwarded: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
};

/* GET /academics/homework/:homeworkId/submissions: every student of the section */
export type Submissions = {
  homework: { id: string; title: string; dueDate: string; maxMarks: number | null };
  students: { studentId: string; rollNumber: string | null; firstName?: string; lastName?: string; status: SubmissionStatus; submission: Submission | null }[];
};

export const HOMEWORK_PATH = "/academics/homework";
export const homeworkPath = (id: string) => `${HOMEWORK_PATH}/${id}`;

export const createHomework = (body: HomeworkInput) => api.post<Homework>(HOMEWORK_PATH, body);
/* bucketId null takes the homework out of its bucket */
export const updateHomework = ({ id, ...body }: Partial<Omit<HomeworkInput, "sectionId" | "subjectId" | "bucketId">> & { id: string; bucketId?: string | null }) => api.patch<Homework>(homeworkPath(id), body);
export const deleteHomework = (id: string) => api.delete<null>(homeworkPath(id));

export const uploadAttachment = ({ id, file }: { id: string; file: File }) => {
  const form = new FormData();
  form.append("file", file);
  return api.upload<StoredFile>(`${homeworkPath(id)}/attachments`, form);
};
export const removeAttachment = ({ id, fileId }: { id: string; fileId: string }) => api.delete<null>(`${homeworkPath(id)}/attachments/${fileId}`);
/* A signed link valid for 15 minutes; needs no token */
export const attachmentUrl = (id: string, fileId: string) => api.get<{ url: string; fileName: string }>(`${homeworkPath(id)}/attachments/${fileId}/download-url`);

export const gradeSubmission = ({ id, submissionId, ...body }: { id: string; submissionId: string; status: "GRADED" | "RETURNED"; marksAwarded?: number; feedback?: string }) =>
  api.post<Submission>(`${homeworkPath(id)}/submissions/${submissionId}/grading`, body);

/* What the backend accepts for attachments (files module, category ATTACHMENT) */
export const ATTACHMENT_RULE = {
  accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/jpeg,image/png,image/webp",
  maxBytes: 10 * 1024 * 1024,
  hint: "PDF, Office, text or an image, up to 10 MB"
};

export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  LATE: "Late",
  GRADED: "Graded",
  RETURNED: "Returned"
};

/* School-wide subjects, for names and the filter without a section */
export type SubjectRow = { id: string; subjectName: string; subjectCode: string };
export function useSubjects() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/academics/subjects", { all: true }],
    enabled: can("academics.subjects.read"),
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchAll<SubjectRow>("/academics/subjects")).sort((a, b) => a.subjectName.localeCompare(b.subjectName))
  });
}

/* Opens an uploaded file through its signed link (a tab is opened first so popup blockers allow it) */
export async function openSigned(get: () => Promise<{ data: { url: string } }>) {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const res = await get();
    if (tab) tab.location.href = res.data.url;
    else window.open(res.data.url, "_blank", "noopener");
  } catch (e) {
    tab?.close();
    throw e;
  }
}
