import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TransportHostelPage from "./pages/TransportHostelPage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  {
    path: "transport-hostel",
    element: (
      <RequirePermission permission={["transport.myTransport.read", "hostel.myHostel.read"]}>
        <TransportHostelPage />
      </RequirePermission>
    )
  }
];
