import type { RouteObject } from "react-router-dom";
import { routes as announcementRoutes } from "./announcements";
import { routes as notificationRoutes } from "./notifications";
import { routes as activityRoutes } from "./activity";

/* Routes of the communication module: announcements (CO-01), send message (CO-02), the inbox
   (SH-06, at /me/notifications) and the module's activity log */
export const routes: RouteObject[] = [...announcementRoutes, ...notificationRoutes, ...activityRoutes];

/* For the app shell: the bell with the unread count */
export { NotificationBell, useUnreadCount } from "./notifications";
