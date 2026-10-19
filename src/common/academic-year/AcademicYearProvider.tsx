import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAcademicYearHeader, type AcademicYear } from "@/common/api";
import { useAuth } from "@/common/auth";

/* The header's year switcher (employees only). Picking a year sends
   X-Academic-Year-Id on every request; the choice is kept per device. */

const STORAGE_KEY = "school.academicYearId";

type Value = {
  years: AcademicYear[];
  current: AcademicYear | null;
  /* The year the app is looking at (the picked one, else the current one) */
  selected: AcademicYear | null;
  /* An archived year is read-only: hide write buttons on year-scoped pages */
  readOnly: boolean;
  canSwitch: boolean;
  select: (id: string | null) => void;
  isLoading: boolean;
};

const Ctx = createContext<Value | null>(null);

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const academicYearsQueryKey = ["academics", "academic-years", "all"] as const;

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { status, can } = useAuth();
  const queryClient = useQueryClient();
  const canSwitch = status === "ready" && can("academics.academicYears.read");
  const [pickedId, setPickedId] = useState<string | null>(() => readStored());

  const { data: years = [], isLoading } = useQuery({
    queryKey: academicYearsQueryKey,
    enabled: canSwitch,
    queryFn: async () =>
      (await api.get<AcademicYear[]>("/academics/academic-years", { limit: 100 }, { academicYearId: null })).data,
    staleTime: 5 * 60_000
  });

  const current = years.find(y => y.isCurrent) ?? null;
  const picked = years.find(y => y.id === pickedId) ?? null;
  const selected = picked ?? current;

  /* Only send the header when a non-current year is picked */
  const headerId = picked && !picked.isCurrent ? picked.id : null;
  setAcademicYearHeader(canSwitch ? headerId : null);

  useEffect(() => {
    if (status === "signedOut") {
      setPickedId(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [status]);

  const value = useMemo<Value>(
    () => ({
      years,
      current,
      selected,
      readOnly: !!selected?.archivedAt,
      canSwitch,
      isLoading,
      select: id => {
        setPickedId(id);
        try {
          if (id) localStorage.setItem(STORAGE_KEY, id);
          else localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        const next = years.find(y => y.id === id);
        setAcademicYearHeader(next && !next.isCurrent ? next.id : null);
        /* Year-scoped data must reload for the new year */
        void queryClient.invalidateQueries();
      }
    }),
    [years, current, selected, canSwitch, isLoading, queryClient]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAcademicYear() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAcademicYear must be used inside <AcademicYearProvider>");
  return ctx;
}
