import type { RouteObject } from "react-router-dom";
import SignInPage from "./pages/SignInPage";

/* Public routes (no session) */
export const routes: RouteObject[] = [
  { path: "/sign-in", element: <SignInPage /> }
];
