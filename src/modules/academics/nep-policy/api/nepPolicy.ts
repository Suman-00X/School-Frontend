import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { useAuth } from "@/common/auth";

/* What the school opts into under NEP 2020 (backend academics/nep-policy): the Holistic
   Progress Card for chosen stages (Exams & results), and the UDISE+ / APAAR student files */

export const NEP_POLICY_PATH = "/academics/nep-policy";

export type NepStage = "FOUNDATIONAL" | "PREPARATORY" | "MIDDLE" | "SECONDARY";

export type NepPolicy = {
  holisticProgressCard: boolean;
  hpcStages: NepStage[];
  udiseExport: boolean;
  apaarExport: boolean;
  udiseCode: string | null;
  stages: { stage: NepStage; label: string; classes: string }[];
  updatedAt: string;
};

export type NepPolicyChanges = Partial<Pick<NepPolicy, "holisticProgressCard" | "hpcStages" | "udiseExport" | "apaarExport" | "udiseCode">>;

export const updateNepPolicy = (changes: NepPolicyChanges) => api.patch<NepPolicy>(NEP_POLICY_PATH, changes);

/* The policy for pages that only show a feature when it is opted into (null until loaded or without access) */
export function useNepPolicy() {
  const { can } = useAuth();
  const q = useApiGet<NepPolicy>(NEP_POLICY_PATH, undefined, { enabled: can("academics.nepPolicy.read") });
  return q.data ?? null;
}
