import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import type { BehaviourRemark, BehaviourSummary } from "@/modules/academics";
import { studentPath } from "../../shared/api/students";

/* GET /me/students/:studentId/behaviour-remarks (the header's year), its summary, and the
   parent's acknowledgement (POST …/:remarkId/acknowledgement) */
export const behaviourPath = (studentId: string) => `${studentPath(studentId)}/behaviour-remarks`;

export const useMyBehaviourSummary = (studentId: string) => useApiGet<BehaviourSummary>(`${behaviourPath(studentId)}/summary`);

export const acknowledgeRemark = ({ studentId, remarkId }: { studentId: string; remarkId: string }) =>
  api.post<BehaviourRemark>(`${behaviourPath(studentId)}/${remarkId}/acknowledgement`);
