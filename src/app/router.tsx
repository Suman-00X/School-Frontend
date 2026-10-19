import { createBrowserRouter, Outlet } from "react-router-dom";
import { PublicOnly, RequireAuth } from "@/common/auth";
import { AppShell } from "@/common/layout/AppShell";
import { NotFound, Page } from "@/common/ui";
import { linkRoutes as authLinkRoutes, publicRoutes as authPublicRoutes, routes as authRoutes } from "@/modules/auth";
import { routes as homeRoutes } from "@/modules/home";
import { importListRoutes, routes as administrationRoutes } from "@/modules/administration";
import { listRoutes as userListRoutes, routes as userRoutes, UserManagementLayout } from "@/modules/users";
import { routes as academicsRoutes } from "@/modules/academics";

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
