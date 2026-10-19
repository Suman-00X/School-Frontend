import type { RouteObject } from "react-router-dom";
import { routes as sessionRoutes } from "./sessions";
import { routes as credentialRoutes } from "./credentials";
import { routes as myAccountRoutes } from "./my-account";

/* Sign-in and password links: no session */
export const publicRoutes: RouteObject[] = [...sessionRoutes, ...credentialRoutes];
/* Inside the app shell */
export const routes: RouteObject[] = [...myAccountRoutes];

/* Used by other modules */
export { InviteButton } from "./credentials/components/InviteButton";
export { sendInvitations, type InvitationResult } from "./credentials/api/invitations";
