import { api } from "@/common/api";
import type { CertificateType } from "@/modules/academics";
import { studentPath } from "../../shared/api/students";

/* GET /me/students/:studentId/certificates: the certificates in force (cancelled ones are
   left out), every year's, newest first; …/:id/document for the screen, …/:id/pdf to print */
export type PortalCertificate = {
  id: string;
  type: CertificateType;
  label: string;
  serialNumber: string;
  student: { id: string; name: string; admissionNumber: string; classSection: string };
  academicYearId: string | null;
  issuedAt: string;
};

export const certificatesPath = (studentId: string) => `${studentPath(studentId)}/certificates`;
const certificatePath = (studentId: string, id: string) => `${certificatesPath(studentId)}/${id}`;

export const portalCertificateDocument = (studentId: string, id: string) => api.get<{ html: string }>(`${certificatePath(studentId, id)}/document`);

export const portalCertificatePdf = (studentId: string, id: string) => api.blob("GET", `${certificatePath(studentId, id)}/pdf`);

export const downloadPortalCertificate = (studentId: string, c: PortalCertificate) =>
  api.download(`${certificatePath(studentId, c.id)}/pdf`, undefined, "certificate.pdf");
