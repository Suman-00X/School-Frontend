import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { roleLabel, type Option } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useEmployees } from "@/modules/administration";
import { useStudentOptions } from "@/modules/users";
import { fetchAllPages, useSchoolCurrency } from "@/modules/users/shared";
import type { Book, CatalogueEntry } from "../api/types";
import { addDaysIso } from "../utils/labels";

/* Money in the school's currency: const money = useMoney(); money(12.5) -> "₹12.50" */
export function useMoney() {
  const currency = useSchoolCurrency();
  return useCallback((n: number | null | undefined) => (n === null || n === undefined ? "" : formatMoney(n, currency)), [currency]);
}

/* Someone who may borrow (a student or an employee) */
export type Borrower = { userId: string; name: string; role: string; className?: string };

type DirectoryRow = { userId: string; name: string; role: string; className: string };

/* Everyone who may borrow, for the desk's picker.
   There is no borrower search (gap): GET /users/students has no search and module owners can't list
   staff. The inactive-borrowers report with a date after today lists every active borrower, students
   and staff, with their class, so holders of library.reports.read use it. Others fall back to the
   student list and (for admins) the staff and teacher lists. `known` adds people already on screen. */
export function useBorrowers(known: Borrower[] = []) {
  const { can } = useAuth();
  const viaReport = can("library.reports.read");
  const report = useQuery({
    queryKey: ["/library/reports/inactive-borrowers", "directory"],
    enabled: viaReport,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await api.get<{ borrowers: DirectoryRow[] }>("/library/reports/inactive-borrowers", { since: addDaysIso(1) })).data.borrowers
  });
  const students = useStudentOptions(!viaReport);
  const employees = useEmployees();

  const knownKey = known.map(k => k.userId).join();
  const borrowers = useMemo(() => {
    const byId = new Map<string, Borrower>();
    if (viaReport) for (const r of report.data ?? []) byId.set(r.userId, { userId: r.userId, name: r.name, role: r.role, className: r.className || undefined });
    else {
      for (const s of students.students) byId.set(s.userId, { userId: s.userId, name: `${s.user.firstName} ${s.user.lastName}`.trim(), role: "STUDENT" });
      for (const p of employees.people) if (p.role !== "PARENT") byId.set(p.id, { userId: p.id, name: p.name, role: p.role ?? "" });
    }
    for (const k of known) if (!byId.has(k.userId)) byId.set(k.userId, k);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaReport, report.data, students.students, employees.people, knownKey]);

  const options = useMemo<Option[]>(
    () =>
      borrowers.map(b => ({
        value: b.userId,
        label: b.name,
        description: [roleLabel(b.role), b.className].filter(Boolean).join(" · ")
      })),
    [borrowers]
  );
  const byId = useMemo(() => new Map(borrowers.map(b => [b.userId, b])), [borrowers]);
  const isLoading = viaReport ? report.isLoading : students.isLoading || employees.isLoading;
  /* Staff can be picked only through the report or the staff lists */
  const coversStaff = viaReport || can("users.staff.read") || can("users.teachers.read");
  return { borrowers, options, byId, isLoading, coversStaff };
}

/* Every title, for book pickers (the staff list when allowed, else the public catalogue) */
export function useBookOptions(enabled = true) {
  const { can } = useAuth();
  const staff = can("library.books.read");
  const path = staff ? "/library/books" : "/library/catalogue";
  const q = useQuery({
    queryKey: [path, "all"],
    enabled: enabled && (staff || can("library.books.browse")),
    staleTime: 60_000,
    queryFn: async () => (await fetchAllPages<Book | CatalogueEntry>(path, {}, 1000)).rows
  });
  const books = q.data;
  const options = useMemo<Option[]>(
    () =>
      (books ?? [])
        .map(b => ({ value: b.id, label: b.title, description: [b.authors.join(", "), b.isbn].filter(Boolean).join(" · ") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [books]
  );
  const byId = useMemo(() => new Map((books ?? []).map(b => [b.id, b])), [books]);
  /* Categories already used, for the category picker and filter */
  const categories = useMemo(
    () => [...new Set((books ?? []).map(b => b.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [books]
  );
  return { books: books ?? [], options, byId, categories, isLoading: q.isLoading };
}

/* Subjects (for the book's subject and the catalogue filter) */
export function useSubjectOptions() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["/academics/subjects", "all"],
    enabled: can("academics.subjects.read"),
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchAllPages<{ id: string; subjectName: string; subjectCode: string }>("/academics/subjects", {}, 500)).rows
  });
  return useMemo<Option[]>(
    () => (q.data ?? []).map(s => ({ value: s.id, label: s.subjectName, description: s.subjectCode })).sort((a, b) => a.label.localeCompare(b.label)),
    [q.data]
  );
}

/* Classes (for class-specific circulation rules) */
export function useClassOptions() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["/academics/classes", "all"],
    enabled: can("academics.classes.read"),
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchAllPages<{ id: string; className: string; classOrder: number }>("/academics/classes", {}, 500)).rows
  });
  return useMemo<Option[]>(
    () => [...(q.data ?? [])].sort((a, b) => a.classOrder - b.classOrder).map(c => ({ value: c.id, label: c.className })),
    [q.data]
  );
}
