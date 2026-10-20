import type { RouteObject } from "react-router-dom";
import { PlatformLayout } from "./components/PlatformLayout";
import OnboardSchoolPage from "./pages/OnboardSchoolPage";
import OperatorSignInPage from "./pages/OperatorSignInPage";
import SchoolDetailPage from "./pages/SchoolDetailPage";
import SchoolsPage from "./pages/SchoolsPage";
import { RequireOperator } from "./shared/guards";

/* The onboarding portal at /platform, for operators (not school accounts): outside the
   school's sign-in and shell, so it is mounted at the top level of the router */
export const routes: RouteObject[] = [
  { path: "/platform/sign-in", element: <OperatorSignInPage /> },
  {
    path: "/platform",
    element: <RequireOperator />,
    children: [
      {
        element: <PlatformLayout />,
        children: [
          { index: true, element: <SchoolsPage /> },
          { path: "schools/new", element: <OnboardSchoolPage /> },
          { path: "schools/:schoolId", element: <SchoolDetailPage /> }
        ]
      }
    ]
  }
];
