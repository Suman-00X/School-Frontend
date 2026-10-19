import type { RouteObject } from "react-router-dom";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SetPasswordPage from "./pages/SetPasswordPage";

/* Public routes (no session) */
export const routes: RouteObject[] = [
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <SetPasswordPage /> },
  /* An invitation link sets the first password with the same endpoint */
  { path: "/set-password", element: <SetPasswordPage mode="invite" /> }
];
