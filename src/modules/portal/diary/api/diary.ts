import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import type { DiaryEntry, DiaryHomework, DiarySignature } from "@/modules/academics";
import { studentPath } from "../../shared/api/students";

/* GET /me/students/:studentId/diary/day?date= and …/days?from=&to= (the header's year), and
   the parent's signature (PUT …/diary/signature) */
export type FamilyDiaryDay = {
  date: string;
  sectionId: string;
  entries: DiaryEntry[];
  homework: DiaryHomework[];
  signature: DiarySignature | null;
  /* Signed before a line was added or changed */
  changedSinceSigned: boolean;
};

export type FamilyDiarySummary = { date: string; entries: number; signedAt: string | null; changedSinceSigned: boolean };

export const diaryPath = (studentId: string) => `${studentPath(studentId)}/diary`;

export const useFamilyDiaryDay = (studentId: string, date: string) => useApiGet<FamilyDiaryDay>(`${diaryPath(studentId)}/day`, { date });
export const useFamilyDiaryDays = (studentId: string, from: string, to: string) =>
  useApiGet<FamilyDiarySummary[]>(`${diaryPath(studentId)}/days`, { from, to });

export const signDiary = ({ studentId, date, note }: { studentId: string; date: string; note?: string }) =>
  api.put<DiarySignature>(`${diaryPath(studentId)}/signature`, note ? { date, note } : { date });
