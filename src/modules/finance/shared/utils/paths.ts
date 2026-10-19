/* Pages of Finance › Setup */
export const SETUP_PATHS = {
  feeHeads: "/finance/fee-heads",
  feeStructures: "/finance/fee-structures",
  installmentPlans: "/finance/installment-plans",
  planAssignments: "/finance/plan-assignments",
  lateFeeRules: "/finance/late-fee-rules",
  concessions: "/finance/concessions",
  concessionGrants: "/finance/concession-grants",
  settings: "/finance/settings"
} as const;

export const feeStructurePath = (id: string) => `${SETUP_PATHS.feeStructures}/${id}`;
