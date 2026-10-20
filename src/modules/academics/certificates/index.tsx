import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CertificatesPage from "./pages/CertificatesPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  {
    path: "/academics/certificates",
    element: (
      <RequirePermission permission={["academics.certificates.read", "academics.certificateFormats.read"]}>
        <CertificatesPage />
      </RequirePermission>
    )
  }
];

/* The portal's certificates page (PO-13) shows them with the same viewer */
export { CertificatePreview } from "./components/CertificatePreview";
export { openPdf, TYPE_ORDER, TYPE_SHORT, type CertificateType } from "./api/certificates";
