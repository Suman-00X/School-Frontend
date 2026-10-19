import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import StudentsListPage from "./pages/StudentsListPage";
import AdmissionWizardPage from "./pages/AdmissionWizardPage";
import StudentProfilePage from "./pages/StudentProfilePage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/users/students", element: <RequirePermission permission="users.students.read"><StudentsListPage /></RequirePermission> },
  { path: "/users/students/new", element: <RequirePermission permission="users.students.admit"><AdmissionWizardPage /></RequirePermission> },
  { path: "/users/students/:studentId", element: <RequirePermission permission="users.students.read"><StudentProfilePage /></RequirePermission> }
];
