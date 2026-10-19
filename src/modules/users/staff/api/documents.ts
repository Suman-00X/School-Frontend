import { api } from "@/common/api";

/* Files uploaded through /files for a staff record (ownerType STAFF, ownerId = staff member id) */
export type StoredFile = {
  id: string;
  ownerType: "STUDENT" | "STAFF" | "GENERAL";
  ownerId: string;
  category: "PHOTO" | "DOCUMENT";
  fileName: string;
  contentType: string;
  size: number;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

/* What the backend accepts per category (files module CATEGORY_RULES) */
export const CATEGORY_RULES = {
  DOCUMENT: {
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    hint: "PDF, Office, text or an image, up to 10 MB"
  },
  PHOTO: { accept: "image/jpeg,image/png,image/webp", maxBytes: 5 * 1024 * 1024, hint: "JPEG, PNG or WebP, up to 5 MB" }
} as const;

export const uploadStaffFile = (staffId: string, input: { file: File; category: string; description: string }) => {
  const form = new FormData();
  form.append("ownerType", "STAFF");
  form.append("ownerId", staffId);
  form.append("category", input.category);
  if (input.description.trim()) form.append("description", input.description.trim());
  form.append("file", input.file);
  return api.upload<StoredFile>("/files", form);
};

/* A signed link valid for 15 minutes; needs no token */
export const fileDownloadUrl = (fileId: string) => api.get<{ url: string; fileName: string }>(`/files/${fileId}/download-url`);

export const deleteFile = (fileId: string) => api.delete<null>(`/files/${fileId}`);
