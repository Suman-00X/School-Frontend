import { api } from "@/common/api";
import type { SubjectRef } from "../../report-cards/api/reportCards";

/* The NEP 2020 Holistic Progress Card of each student per exam (backend academics/holistic-progress) */

export const HPC_PATH = "/academics/holistic-progress";

export type HpcLevel = "BEGINNER" | "PROFICIENT" | "ADVANCED";
export type AbilityKey = "awareness" | "sensitivity" | "creativity";
export type ReflectionKey = "interests" | "strengths" | "areasToImprove" | "teacherRemark" | "parentFeedback";

export type HpcStage = { stage: string; label: string; levels: { value: HpcLevel; label: string }[] };

export type HpcEntry = {
  subjectId: string;
  awareness: HpcLevel | null;
  sensitivity: HpcLevel | null;
  creativity: HpcLevel | null;
  selfAssessment: HpcLevel | null;
  peerAssessment: HpcLevel | null;
  remark: string | null;
};

type Common = {
  exam: { id: string; examName: string; startDate: string | null; endDate: string | null };
  stage: HpcStage;
  abilities: { key: AbilityKey; label: string }[];
  reflections: { key: ReflectionKey; label: string }[];
};

export type HpcSectionStudent = {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  assessedSubjects: number;
  reflections: boolean;
  complete: boolean;
  updatedAt: string | null;
};

export type HpcSection = Common & {
  section: { id: string; name: string };
  subjects: SubjectRef[];
  students: HpcSectionStudent[];
  summary: { students: number; complete: number; started: number };
};

export type HpcCard = Common &
  Record<ReflectionKey, string | null> & {
    school: { name: string | null; udiseCode: string | null };
    student: {
      id: string;
      firstName: string;
      middleName: string | null;
      lastName: string;
      gender: string | null;
      dob: string | null;
      admissionNumber: string;
      pen: string | null;
      apaarId: string | null;
      motherTongue: string | null;
      rollNumber: string | null;
      section: { id: string; name: string };
    };
    subjects: { subject: SubjectRef; entry: HpcEntry | null }[];
    updatedAt: string | null;
    academic: {
      policy: string | null;
      percentage: number | null;
      grade: string | null;
      result: string;
      subjects: { subjectId: string; subjectName: string; grade: string | null; percentage: number | null }[];
    } | null;
    attendance: { from: string; to: string; workingDays: number; attendedDays: number; percentage: number | null } | null;
  };

export type HpcSave = Partial<Record<ReflectionKey, string | null>> & { subjects: HpcEntry[] };

export const hpcSectionPath = (examId: string, sectionId: string) => `${HPC_PATH}/exams/${examId}/sections/${sectionId}`;
export const hpcStudentPath = (examId: string, studentId: string) => `${HPC_PATH}/exams/${examId}/students/${studentId}`;

export const saveHpc = ({ examId, studentId, body }: { examId: string; studentId: string; body: HpcSave }) =>
  api.put<HpcCard>(hpcStudentPath(examId, studentId), body);

export const downloadHpcPdf = (examId: string, studentId: string) =>
  api.download(`${hpcStudentPath(examId, studentId)}/pdf`, undefined, "holistic-progress-card.pdf");
