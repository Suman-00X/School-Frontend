import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/* List state (page, limit, filters) kept in the page URL so refresh and shared links keep it.
   const { params, setParam, setParams, setPage } = useListParams({ role: "", status: "" });
   Any filter change goes back to page 1. */
export function useListParams<F extends Record<string, string>>(filterDefaults: F, opts: { limit?: number } = {}) {
  const [search, setSearch] = useSearchParams();
  const defaultsKey = JSON.stringify(filterDefaults);

  const params = useMemo(() => {
    const defaults = JSON.parse(defaultsKey) as F;
    const filters = {} as F;
    for (const key of Object.keys(defaults) as (keyof F)[])
      filters[key] = (search.get(key as string) ?? defaults[key]) as F[keyof F];
    return {
      ...filters,
      page: Math.max(1, Number(search.get("page")) || 1),
      limit: Math.min(100, Number(search.get("limit")) || opts.limit || 20)
    };
  }, [search, defaultsKey, opts.limit]);

  const setParams = useCallback(
    (changes: Partial<F> & { page?: number }) =>
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          const defaults = JSON.parse(defaultsKey) as F;
          for (const [k, v] of Object.entries(changes)) {
            if (k === "page") continue;
            if (v === undefined || v === null || v === "" || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          }
          if (changes.page && changes.page > 1) next.set("page", String(changes.page));
          else next.delete("page");
          return next;
        },
        { replace: true }
      ),
    [setSearch, defaultsKey]
  );

  const setParam = useCallback((key: keyof F, value: string) => setParams({ [key]: value } as Partial<F>), [setParams]);
  const setPage = useCallback(
    (page: number) =>
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          if (page > 1) next.set("page", String(page));
          else next.delete("page");
          return next;
        },
        { replace: true }
      ),
    [setSearch]
  );

  return { params, setParams, setParam, setPage };
}
