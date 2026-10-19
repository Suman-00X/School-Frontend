import type { RouteObject } from "react-router-dom";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SetPasswordPage from "./pages/SetPasswordPage";

/* Public, for people who are not signed in */
export const routes: RouteObject[] = [{ path: "/forgot-password", element: <ForgotPasswordPage /> }];

/* Emailed links: open whether or not someone is signed in on this device */
export const linkRoutes: RouteObject[] = [
  { path: "/reset-password", element: <SetPasswordPage /> },
  /* An invitation link sets the first password with the same endpoint */
  { path: "/set-password", element: <SetPasswordPage mode="invite" /> }
];
