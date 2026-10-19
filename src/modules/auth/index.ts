import type { RouteObject } from "react-router-dom";
import { routes as sessionRoutes } from "./sessions";
import { linkRoutes as passwordLinkRoutes, routes as credentialRoutes } from "./credentials";
import { routes as myAccountRoutes } from "./my-account";

/* Sign-in and forgot password: not signed in */
export const publicRoutes: RouteObject[] = [...sessionRoutes, ...credentialRoutes];
/* Reset and invitation links: no session needed, but a signed-in person may open them too */
export const linkRoutes: RouteObject[] = passwordLinkRoutes;
/* Inside the app shell */
export const routes: RouteObject[] = [...myAccountRoutes];

/* Used by other modules */
export { InviteButton } from "./credentials/components/InviteButton";
export { sendInvitations, type InvitationResult } from "./credentials/api/invitations";
