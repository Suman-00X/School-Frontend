import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import DeskPage from "./pages/DeskPage";
import LoansPage from "./pages/LoansPage";
import BorrowerPage from "./pages/BorrowerPage";

/* LB-04 desk, LB-05 loans (the drawer has its own URL) and borrower accounts */
export const routes: RouteObject[] = [
  { path: "/library/desk", element: <RequirePermission permission="library.loans.circulate"><DeskPage /></RequirePermission> },
  { path: "/library/loans/:loanId?", element: <RequirePermission permission="library.loans.read"><LoansPage /></RequirePermission> },
  { path: "/library/borrowers/:userId", element: <RequirePermission permission="library.loans.read"><BorrowerPage /></RequirePermission> }
];
