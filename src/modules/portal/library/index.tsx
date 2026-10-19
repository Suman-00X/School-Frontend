import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import MyLibraryPage from "./pages/MyLibraryPage";

/* Everyone's own loans, reservations and fines (a parent: their children's) */
export const routes: RouteObject[] = [
  { path: "/library/my-loans", element: <RequirePermission permission={["library.loans.readOwn", "library.holds.own"]}><MyLibraryPage /></RequirePermission> }
];
