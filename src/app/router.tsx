import { createBrowserRouter, Outlet } from "react-router-dom";
import { PublicOnly, RequireAuth } from "@/common/auth";
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
          ...financeRoutes,
          ...communicationRoutes,
          ...libraryRoutes,
          ...transportRoutes,
          ...hostelRoutes,
          ...hrRoutes,
          ...inventoryRoutes,
          ...reportsRoutes,
          ...filesRoutes,
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
