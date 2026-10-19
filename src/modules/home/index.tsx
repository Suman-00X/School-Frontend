import type { RouteObject } from "react-router-dom";
import HomePage from "./pages/HomePage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/", element: <HomePage /> }
];
