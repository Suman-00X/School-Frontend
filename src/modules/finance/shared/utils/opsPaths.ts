/* Pages of Finance operations (FI-07 to FI-14) */
export const OPS_PATHS = {
  counter: "/finance/counter",
  invoices: "/finance/invoices",
  payments: "/finance/payments",
  refunds: "/finance/refunds",
  settlements: "/finance/settlements",
  ledger: "/finance/ledger",
  accounts: "/finance/ledger/accounts",
  journal: "/finance/ledger/journal-entries",
  newJournalEntry: "/finance/ledger/journal-entries/new",
  trialBalance: "/finance/ledger/trial-balance",
  incomeSummary: "/finance/ledger/income-summary",
  activity: "/finance/activity",
  invoice: (id: string) => `/finance/invoices/${id}`,
  payment: (id: string) => `/finance/payments/${id}`,
  refund: (id: string) => `/finance/refunds/${id}`,
  account: (id: string) => `/finance/ledger/accounts/${id}`,
  journalEntry: (id: string) => `/finance/ledger/journal-entries/${id}`,
  student: (id: string) => `/finance/students/${id}`,
  /* The counter with a student (and optionally an invoice) picked */
  collect: (studentId?: string, invoiceId?: string) => {
    const q = new URLSearchParams();
    if (studentId) q.set("studentId", studentId);
    if (invoiceId) q.set("invoiceId", invoiceId);
    const s = q.toString();
    return s ? `/finance/counter?${s}` : "/finance/counter";
  }
} as const;
