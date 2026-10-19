import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { fetchAllPages } from "@/modules/users/shared";

export const VENDORS_PATH = "/inventory/vendors";

export type Vendor = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  /* GSTIN for schools in India */
  taxId: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
};

export type VendorInput = Partial<Omit<Vendor, "id" | "createdAt">> & { name: string };

export const createVendor = (body: VendorInput) => api.post<Vendor>(VENDORS_PATH, body);
export const updateVendor = ({ id, ...body }: Partial<VendorInput> & { id: string }) => api.patch<Vendor>(`${VENDORS_PATH}/${id}`, body);
export const removeVendor = (id: string) => api.delete<null>(`${VENDORS_PATH}/${id}`);

/* Every vendor, for the receipt form's picker */
export function useAllVendors(enabled = true) {
  return useQuery({
    queryKey: [VENDORS_PATH, "all"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => (await fetchAllPages<Vendor>(VENDORS_PATH, {}, 1000)).rows
  });
}
