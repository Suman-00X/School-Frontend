import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useApiList, useApiMutation } from "@/common/hooks";

export type ImportStatus = "MAPPING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export const IMPORT_STATUSES: ImportStatus[] = ["MAPPING", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];
export const RUNNING: ImportStatus[] = ["QUEUED", "PROCESSING"];

/* A row of GET /administration/imports */
export type ImportJob = {
  id: string;
  type: "STUDENTS";
  status: ImportStatus;
  fileName: string;
  options: { academicYearId?: string };
  mapping: Record<string, string>;
  totalRows: number;
  processedRows: number;
  succeeded: number;
  failed: number;
  failureReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type MappingField = { field: string; label: string; required: boolean; column: string | null };
export type MappingColumn = { header: string; mapped: boolean; samples: string[] };
export type PreviewRow = { row: number; ok: boolean; message?: string };
export type RowError = { row: number; message: string };

/* GET /administration/imports/:importId. While MAPPING it carries the mapping view
   (columns as objects); afterwards columns are the plain headers. */
export type ImportView = Omit<ImportJob, "columns"> & {
  rowErrors: RowError[];
  columns: MappingColumn[] | string[];
  fields?: MappingField[];
  missingRequired?: string[];
  preview?: PreviewRow[];
};

const BASE = "/administration/imports";

export const useImports = (query: { status?: string; page: number; limit: number }) => useApiList<ImportJob>(BASE, query);

/* Polls every 3 s while the import is queued or running */
export const useImport = (importId: string | undefined) =>
  useQuery({
    queryKey: [`${BASE}/${importId}`],
    enabled: !!importId,
    queryFn: async ({ signal }) => (await api.get<ImportView>(`${BASE}/${importId}`, undefined, { signal })).data,
    refetchInterval: q => (q.state.data && RUNNING.includes(q.state.data.status) ? 3000 : false)
  });

export const downloadTemplate = () => api.download(`${BASE}/students/template`, undefined, "student-import-template.csv");

export const useUploadStudents = () =>
  useApiMutation(
    ({ file, academicYearId }: { file: File; academicYearId?: string }) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<ImportView>(`${BASE}/students`, form, { query: { academicYearId } });
    },
    { invalidate: [BASE] }
  );

/* Writes on one import answer with its fresh view: show it at once, then refresh the list */
function useImportWrite<TVars>(importId: string, fn: (vars: TVars) => Promise<{ data: ImportView; message: string }>) {
  const qc = useQueryClient();
  return useApiMutation(fn, {
    invalidate: [BASE],
    onSuccess: res => qc.setQueryData([`${BASE}/${importId}`], res.data)
  });
}

export const useUpdateMapping = (importId: string) =>
  useImportWrite(importId, (mapping: Record<string, string | null>) => api.patch<ImportView>(`${BASE}/${importId}`, { mapping }));

export const useStartImport = (importId: string) =>
  useImportWrite(importId, () => api.post<ImportView>(`${BASE}/${importId}/start`));

export const useCancelImport = (importId: string) =>
  useImportWrite(importId, () => api.delete<ImportView>(`${BASE}/${importId}`));
