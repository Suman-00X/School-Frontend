import { Navigate, type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { LedgerLayout } from "./components/LedgerLayout";
import AccountsPage from "./pages/AccountsPage";
import AccountLedgerPage from "./pages/AccountLedgerPage";
import JournalPage from "./pages/JournalPage";
import NewJournalEntryPage from "./pages/NewJournalEntryPage";
import TrialBalancePage from "./pages/TrialBalancePage";
import IncomeSummaryPage from "./pages/IncomeSummaryPage";

/* Finance › Ledger (FI-13): accounts, journal, trial balance and income summary in one side list.
   A journal entry opens as a drawer over the journal. */
export const routes: RouteObject[] = [
  {
    path: "/finance/ledger",
    element: (
      <RequirePermission permission="finance.ledger.read">
        <LedgerLayout />
      </RequirePermission>
    ),
    children: [
      { index: true, element: <Navigate to="/finance/ledger/accounts" replace /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "accounts/:accountId", element: <AccountLedgerPage /> },
      { path: "journal-entries", element: <JournalPage /> },
      { path: "journal-entries/new", element: <RequirePermission permission="finance.ledger.post"><NewJournalEntryPage /></RequirePermission> },
      { path: "journal-entries/:entryId", element: <JournalPage /> },
      { path: "trial-balance", element: <TrialBalancePage /> },
      { path: "income-summary", element: <IncomeSummaryPage /> }
    ]
  }
];
