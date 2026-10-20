import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import type { Tone } from "@/common/ui";

/* GET /academics/behaviour-remarks (header's year) and the portal's /me/students/:id/behaviour-remarks */
export type RemarkKind = "APPRECIATION" | "NOTE" | "CONCERN" | "INCIDENT";

export type RemarkPerson = { id: string; firstName: string; lastName: string; role: string };

export type BehaviourRemark = {
  id: string;
  academicYearId: string;
  studentId: string;
  sectionId: string;
  occurredOn: string;
  kind: RemarkKind;
  category: string;
  remark: string;
  actionTaken: string | null;
  recordedBy: string;
  recorder: RemarkPerson | null;
  acknowledgedAt: string | null;
  acknowledger: RemarkPerson | null;
  student: { id: string; admissionNumber: string; studentCode: string; user: { firstName: string; lastName: string } } | null;
  /* Staff API only: the author, the principal or an admin */
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BehaviourSummary = { counts: Record<RemarkKind, number>; total: number; unacknowledged: number; lastOn: string | null };

export type RemarkInput = { studentId: string; occurredOn: string; kind: RemarkKind; category: string; remark: string; actionTaken?: string };

export const BEHAVIOUR_PATH = "/academics/behaviour-remarks";
export const remarkPath = (id: string) => `${BEHAVIOUR_PATH}/${id}`;
export const summaryPath = (studentId: string) => `${BEHAVIOUR_PATH}/students/${studentId}/summary`;

export const REMARK_KINDS: { value: RemarkKind; label: string; tone: Tone; description: string }[] = [
  { value: "APPRECIATION", label: "Appreciation", tone: "success", description: "Something done well, worth praising" },
  { value: "NOTE", label: "Note", tone: "info", description: "An observation for the family to know" },
  { value: "CONCERN", label: "Concern", tone: "warning", description: "Behaviour to work on; parents acknowledge it" },
  { value: "INCIDENT", label: "Serious incident", tone: "danger", description: "A serious breach of discipline" }
];
export const KIND_OF = Object.fromEntries(REMARK_KINDS.map(k => [k.value, k])) as Record<RemarkKind, (typeof REMARK_KINDS)[number]>;

/* The API's fixed list (academics/behaviour-remarks constants) */
export const REMARK_CATEGORIES = [
  { value: "DISCIPLINE", label: "Discipline" },
  { value: "PUNCTUALITY", label: "Punctuality" },
  { value: "UNIFORM", label: "Uniform & grooming" },
  { value: "CLASSWORK", label: "Classwork & homework" },
  { value: "PARTICIPATION", label: "Participation" },
  { value: "RESPECT", label: "Respect & manners" },
  { value: "KINDNESS", label: "Kindness & teamwork" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "SAFETY", label: "Safety" },
  { value: "OTHER", label: "Other" }
];
export const categoryLabel = (key: string) => REMARK_CATEGORIES.find(c => c.value === key)?.label ?? key;

export const useBehaviourSummary = (studentId: string | null) => useApiGet<BehaviourSummary>(studentId ? summaryPath(studentId) : null);

export const createRemark = (body: RemarkInput) => api.post<BehaviourRemark>(BEHAVIOUR_PATH, body);
export const updateRemark = ({ id, ...body }: Partial<Omit<RemarkInput, "studentId">> & { id: string }) => api.patch<BehaviourRemark>(remarkPath(id), body);
export const deleteRemark = (id: string) => api.delete<null>(remarkPath(id));
