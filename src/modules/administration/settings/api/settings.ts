import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";

/* GET /administration/settings */
export type SchoolSettings = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  timezone: string;
  currency: string;
  country: string;
  updatedAt: string;
  /* Signed link, valid for an hour */
  logoUrl: string | null;
};

export type SettingsChanges = Partial<
  Pick<SchoolSettings, "name" | "address" | "contactEmail" | "contactPhone" | "description" | "timezone" | "currency" | "country">
>;

const PATH = "/administration/settings";

/* Same key as the app shell's brand query, so both share one cache entry */
export const useSettings = () => useApiGet<SchoolSettings>(PATH, undefined, { key: [PATH] });

export const useUpdateSettings = () =>
  useApiMutation((changes: SettingsChanges) => api.patch<SchoolSettings>(PATH, changes), { invalidate: [PATH] });

export const useUploadLogo = () =>
  useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<SchoolSettings>(`${PATH}/logo`, form, { method: "PUT" });
    },
    { invalidate: [PATH] }
  );
