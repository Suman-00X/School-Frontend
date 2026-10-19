import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import InboxPage from "./pages/InboxPage";
import SendMessagePage from "./pages/SendMessagePage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/me/notifications", element: <RequirePermission permission="communication.notifications.inbox"><InboxPage /></RequirePermission> },
  { path: "/communication/messages/new", element: <RequirePermission permission="communication.notifications.send"><SendMessagePage /></RequirePermission> }
];

export { NotificationBell } from "./components/NotificationBell";
export { useUnreadCount } from "./api/notifications";
