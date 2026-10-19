import type { RouteObject } from "react-router-dom";
import MyAccountPage from "./pages/MyAccountPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/me/account", element: <MyAccountPage /> }
];
