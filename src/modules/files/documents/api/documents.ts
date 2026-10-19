import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { fullName } from "@/common/utils/format";
import { fetchAllPages } from "@/modules/users/shared";

export const OWNER_TYPES = ["STUDENT", "STAFF", "GENERAL"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];
export type FileCategory = "PHOTO" | "DOCUMENT";

/* GET /files rows; GET /files/:fileId adds the checksum */
export type StoredFile = {
  id: string;
  ownerType: OwnerType;
  /* Student or staff-member id; the school's id for GENERAL */
  ownerId: string;
  category: FileCategory;
  fileName: string;
  contentType: string;
  size: number;
  description: string | null;
  /* A user id (no name embedded) */
  uploadedBy: string | null;
  checksum?: string;
  createdAt: string;
};

export const FILES_PATH = "/files";

/* What the backend accepts per category (files CATEGORY_RULES) */
export const FILE_RULES: Record<FileCategory, { accept: string; maxBytes: number; hint: string; label: string }> = {
  DOCUMENT: {
    label: "Document",
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    hint: "PDF, Word, Excel, PowerPoint, text, CSV or an image, up to 10 MB"
  },
  PHOTO: { label: "Photo", accept: "image/jpeg,image/png,image/webp", maxBytes: 5 * 1024 * 1024, hint: "JPEG, PNG or WebP, up to 5 MB" }
};

export const OWNER_LABELS: Record<OwnerType, { tab: string; one: string }> = {
  STUDENT: { tab: "Student documents", one: "Student" },
  STAFF: { tab: "Staff documents", one: "Staff member" },
  GENERAL: { tab: "General", one: "Whole school" }
};

export const uploadFile = (input: { ownerType: OwnerType; ownerId: string; category: FileCategory; description: string; file: File }) => {
  const form = new FormData();
  form.append("ownerType", input.ownerType);
  if (input.ownerType !== "GENERAL") form.append("ownerId", input.ownerId);
  form.append("category", input.category);
  if (input.description.trim()) form.append("description", input.description.trim());
  form.append("file", input.file);
  return api.upload<StoredFile>(FILES_PATH, form);
};

export const deleteFile = (id: string) => api.delete<null>(`${FILES_PATH}/${id}`);

/* A signed link valid for 15 minutes; needs no token. Never cache it. */
export const downloadUrl = (id: string) => api.get<{ url: string; fileName: string; contentType: string; expiresAt: string }>(`${FILES_PATH}/${id}/download-url`);

type StaffRow = { id: string; userId: string; employeeCode: string; designation: string | null; user: { id: string; firstName: string; lastName: string; email: string; role: string } };

/* Staff records the person may list (ADMIN, PRINCIPAL), for the owner picker and names */
export function useStaffRecords() {
  const { can } = useAuth();
  const allowed = can("users.staff.read");
  const q = useQuery({
    queryKey: ["/users/staff", "all"],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => fetchAllPages<StaffRow>("/users/staff", {}, 1000)
  });
  const rows = q.data?.rows;
  const options = useMemo(
    () =>
      (rows ?? [])
        .map(s => ({ value: s.id, label: fullName(s.user), description: [s.employeeCode, s.designation].filter(Boolean).join(" · ") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rows]
  );
  const byId = useMemo(() => new Map((rows ?? []).map(s => [s.id, s])), [rows]);
  return { allowed, options, byId, isLoading: q.isLoading };
}

/* "PDF", "Word", "Image"… from the content type */
export function kindOf(contentType: string) {
  if (contentType.startsWith("image/")) return "Image";
  if (contentType === "application/pdf") return "PDF";
  if (/word/.test(contentType)) return "Word";
  if (/excel|spreadsheet/.test(contentType)) return "Excel";
  if (/powerpoint|presentation/.test(contentType)) return "PowerPoint";
  if (contentType === "text/csv") return "CSV";
  if (contentType.startsWith("text/")) return "Text";
  return "File";
}
