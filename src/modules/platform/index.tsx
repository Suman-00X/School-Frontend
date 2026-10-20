import type { RouteObject } from "react-router-dom";
import { PlatformLayout } from "./components/PlatformLayout";
import OnboardSchoolPage from "./pages/OnboardSchoolPage";
import SchoolDetailPage from "./pages/SchoolDetailPage";
import SchoolsPage from "./pages/SchoolsPage";
import SystemAdminSignInPage from "./pages/SystemAdminSignInPage";
import { RequireSystemAdmin } from "./shared/guards";

/* The admin console at /adminConsole, for the platform's system admins (not school
   accounts): outside the school's sign-in and shell, so it is mounted at the top level of
   the router. Without a system admin's session cookie it asks them to sign in. */
export const routes: RouteObject[] = [
  { path: "/adminConsole/sign-in", element: <SystemAdminSignInPage /> },
  {
    path: "/adminConsole",
    element: <RequireSystemAdmin />,
    children: [
      {
        element: <PlatformLayout />,
        children: [
          { index: true, element: <SchoolsPage /> },
          { path: "tenants/new", element: <OnboardSchoolPage /> },
          { path: "tenants/:schoolId", element: <SchoolDetailPage /> }
        ]
      }
    ]
  }
];
