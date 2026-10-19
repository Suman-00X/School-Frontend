import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* The school's currency for money fields. Shares the shell's settings query; INR when settings are closed to the caller. */
export function useSchoolCurrency() {
  const { can } = useAuth();
  const settings = useQuery({
    queryKey: ["/administration/settings"],
    enabled: can("administration.settings.read"),
    staleTime: 30 * 60_000,
    queryFn: async () => (await api.get<{ currency?: string }>("/administration/settings")).data
  });
  return settings.data?.currency ?? "INR";
}
