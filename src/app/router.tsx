import { createBrowserRouter, Outlet, type RouteObject } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireModule } from "@/common/auth";
import { AppShell } from "@/common/layout/AppShell";
import { NotFound, Page } from "@/common/ui";
import { linkRoutes as authLinkRoutes, publicRoutes as authPublicRoutes, routes as authRoutes } from "@/modules/auth";
import { routes as homeRoutes } from "@/modules/home";
import { importListRoutes, routes as administrationRoutes } from "@/modules/administration";
import { listRoutes as userListRoutes, routes as userRoutes, UserManagementLayout } from "@/modules/users";
import { routes as academicsRoutes } from "@/modules/academics";
import { routes as portalRoutes } from "@/modules/portal";
import { routes as financeRoutes } from "@/modules/finance";
import { routes as communicationRoutes } from "@/modules/communication";
import { routes as libraryRoutes } from "@/modules/library";
import { routes as transportRoutes } from "@/modules/transport";
import { routes as hostelRoutes } from "@/modules/hostel";
import { routes as hrRoutes } from "@/modules/hr";
import { routes as inventoryRoutes } from "@/modules/inventory";
import { routes as reportsRoutes } from "@/modules/reports";
import { routes as filesRoutes } from "@/modules/files";
import { routes as platformRoutes } from "@/modules/platform";

/* An add-on module's pages exist only when the module is switched on for the school */
const addOn = (module: string, children: RouteObject[]): RouteObject => ({ element: <RequireModule module={module} />, children });

export const router = createBrowserRouter([
  {
    element: (
      <PublicOnly>
        <Outlet />
      </PublicOnly>
    ),
    children: authPublicRoutes
  },
  ...authLinkRoutes,
  /* The admin console (system admins): its own sign-in and frame */
  ...platformRoutes,
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          ...homeRoutes,
          ...authRoutes,
          /* Admin › User Management: the user lists and imports share one side list */
          { element: <UserManagementLayout />, children: [...userListRoutes, ...importListRoutes] },
          ...userRoutes,
          ...academicsRoutes,
          ...portalRoutes,
          addOn("finance", financeRoutes),
          addOn("communication", communicationRoutes),
          addOn("library", libraryRoutes),
          addOn("transport", transportRoutes),
          addOn("hostel", hostelRoutes),
          addOn("hr", hrRoutes),
          addOn("inventory", inventoryRoutes),
          addOn("reports", reportsRoutes),
          addOn("files", filesRoutes),
          ...administrationRoutes,
          {
            path: "*",
            element: (
              <Page>
                <NotFound message="This page does not exist." />
              </Page>
            )
          }
        ]
      }
    ]
  }
]);
