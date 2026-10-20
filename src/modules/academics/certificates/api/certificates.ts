import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* Certificates issued to students (backend academics/certificates) and the school's formats
   for them and for the report card: HTML + CSS with {{placeholders}}, every save a new version. Issuing freezes the
   student's details with the format version in use, so a reprint is the same certificate. */

export type CertificateType = "BONAFIDE" | "CHARACTER" | "TRANSFER";
/* The documents with an HTML format: the certificates and the report card */
export type FormatType = CertificateType | "REPORT_CARD";
export type CertificateStatus = "ISSUED" | "CANCELLED";

export type CertificateInput = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "date" | "number" | "choice";
  required?: boolean;
  options?: string[];
  max?: number;
  hint?: string;
};

/* insert: what the editor puts in (a list's field is {{field}} inside {{#each list}}) */
export type PlaceholderGroup = { group: string; fields: { key: string; label: string; sample: string; insert?: string }[] };

/* GET /academics/certificates/types */
export type CertificateTypeInfo = {
  type: CertificateType;
  label: string;
  prefix: string;
  description: string;
  inputs: CertificateInput[];
  placeholders: PlaceholderGroup[];
};

export type Certificate = {
  id: string;
  type: CertificateType;
  label: string;
  serialNumber: string;
  status: CertificateStatus;
  student: { id: string; name: string; admissionNumber: string; classSection: string };
  academicYearId: string | null;
  formatVersion: { id: string; version?: number; name?: string };
  /* What was entered when issuing (dates as YYYY-MM-DD) */
  inputs: Record<string, string>;
  issuedAt: string;
  issuedBy: { id: string; name: string } | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /* Issue only: a TC marked the student's enrollment LEFT */
  markedLeft?: boolean;
};

/* GET /academics/certificates/draft: the inputs' starting values for a student */
export type CertificateDraft = {
  type: CertificateType;
  studentId: string;
  inputs: Record<string, string>;
  student: { name: string; classSection: string };
  enrollmentStatus: "ACTIVE" | "LEFT" | null;
  earlier: Certificate[];
  /* Why it can't be issued (a TC already in force) */
  blocked: string | null;
};

export type FormatVersion = {
  id: string;
  type: FormatType;
  version: number;
  name: string;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  /* Single version reads only */
  html?: string;
  css?: string;
  /* The list of formats and the format in use */
  label?: string;
  /* The format in use only: the fields the editor offers */
  placeholders?: PlaceholderGroup[];
};

export const CERTIFICATES_PATH = "/academics/certificates";
export const FORMATS_PATH = "/academics/certificate-formats";
export const certificatePath = (id: string) => `${CERTIFICATES_PATH}/${id}`;
const formatPath = (type: FormatType) => `${FORMATS_PATH}/${type}`;

export const TYPE_ORDER: CertificateType[] = ["BONAFIDE", "CHARACTER", "TRANSFER"];
export const TYPE_SHORT: Record<CertificateType, string> = { BONAFIDE: "Bonafide", CHARACTER: "Character", TRANSFER: "Transfer (TC)" };
export const FORMAT_ORDER: FormatType[] = [...TYPE_ORDER, "REPORT_CARD"];
export const FORMAT_SHORT: Record<FormatType, string> = { ...TYPE_SHORT, REPORT_CARD: "Report card" };

export function useCertificateTypes() {
  const { canAny } = useAuth();
  return useQuery({
    queryKey: [`${CERTIFICATES_PATH}/types`],
    enabled: canAny("academics.certificates.read", "academics.certificateFormats.read"),
    staleTime: 10 * 60_000,
    queryFn: async () => (await api.get<{ types: CertificateTypeInfo[] }>(`${CERTIFICATES_PATH}/types`)).data.types
  });
}

export const getDraft = (type: CertificateType, studentId: string) =>
  api.get<CertificateDraft>(`${CERTIFICATES_PATH}/draft`, { type, studentId });

export const previewCertificate = (body: { type: CertificateType; studentId: string; inputs: Record<string, string> }, signal?: AbortSignal) =>
  api.post<{ html: string }>(`${CERTIFICATES_PATH}/preview`, body, { signal });

export const issueCertificate = (body: { type: CertificateType; studentId: string; inputs: Record<string, string>; markLeft: boolean }) =>
  api.post<Certificate>(CERTIFICATES_PATH, body);

export const cancelCertificate = ({ id, reason }: { id: string; reason: string }) => api.post<Certificate>(`${certificatePath(id)}/cancel`, { reason });

export const certificateDocument = (id: string) => api.get<{ html: string }>(`${certificatePath(id)}/document`);

export const downloadCertificate = (c: Certificate) => api.download(`${certificatePath(c.id)}/pdf`, undefined, "certificate.pdf");

export const certificatePdf = (id: string) => api.blob("GET", `${certificatePath(id)}/pdf`);

/* Formats */

export const useFormat = (type: FormatType) =>
  useQuery({ queryKey: [formatPath(type)], queryFn: async () => (await api.get<FormatVersion>(formatPath(type))).data });

export const useFormatVersions = (type: FormatType, enabled: boolean) =>
  useQuery({
    queryKey: [`${formatPath(type)}/versions`],
    enabled,
    queryFn: async () => (await api.get<FormatVersion[]>(`${formatPath(type)}/versions`)).data
  });

export const getFormatVersion = (type: FormatType, version: number) => api.get<FormatVersion>(`${formatPath(type)}/versions/${version}`);

export type FormatDraft = { name: string; html: string; css: string };

export const saveFormat = ({ type, ...body }: FormatDraft & { type: FormatType; note?: string; baseVersion: number }) =>
  api.post<FormatVersion>(`${formatPath(type)}/versions`, body);

export const restoreFormat = ({ type, version }: { type: FormatType; version: number }) =>
  api.post<FormatVersion>(`${formatPath(type)}/versions/${version}/restore`, {});

export const previewFormat = (type: FormatType, body: FormatDraft & { studentId?: string }, signal?: AbortSignal) =>
  api.post<{ html: string }>(`${formatPath(type)}/preview`, body, { signal });

export const previewFormatPdf = (type: FormatType, body: FormatDraft & { studentId?: string }) =>
  api.blob("POST", `${formatPath(type)}/preview/pdf`, { body });

/* Open a PDF in a new tab. The tab opens at once (a popup opened after a fetch is blocked)
   and shows the file when it arrives; it closes again when the fetch fails. */
export async function openPdf(load: () => Promise<{ blob: Blob }>) {
  const tab = window.open("", "_blank");
  try {
    const { blob } = await load();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
