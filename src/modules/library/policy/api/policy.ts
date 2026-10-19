import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import type { LibraryPolicy } from "../../shared/api/types";

export const POLICY_PATH = "/library/policy";

export type PolicyChanges = Partial<Omit<LibraryPolicy, "id" | "createdAt" | "updatedAt" | "setupNeeded">>;

/* The first read creates the policy and the default circulation rules */
export const usePolicy = () => useApiGet<LibraryPolicy>(POLICY_PATH);

export const useUpdatePolicy = () =>
  useApiMutation((body: PolicyChanges) => api.patch<LibraryPolicy>(POLICY_PATH, body), { invalidate: [POLICY_PATH, "/library/borrowers"] });
