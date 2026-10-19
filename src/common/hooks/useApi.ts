import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, type ListMeta, type Query } from "@/common/api";

/* GET a paginated list: { rows, meta, ...query } */
export function useApiList<T>(path: string, query: Query = {}, opts: { enabled?: boolean; key?: QueryKey } = {}) {
  const q = useQuery({
    queryKey: opts.key ?? [path, query],
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await api.get<T[]>(path, query, { signal });
      return { rows: res.data, meta: res.meta as ListMeta | undefined };
    }
  });
  return { ...q, rows: q.data?.rows, meta: q.data?.meta };
}

/* GET one record */
export function useApiGet<T>(path: string | null, query?: Query, opts: { enabled?: boolean; key?: QueryKey } = {}) {
  return useQuery({
    queryKey: opts.key ?? [path, query ?? {}],
    enabled: !!path && (opts.enabled ?? true),
    queryFn: async ({ signal }) => (await api.get<T>(path!, query, { signal })).data
  });
}

/* A write that refreshes every query whose key starts with one of `invalidate` (path prefixes) */
export function useApiMutation<TVars, TData = unknown>(
  fn: (vars: TVars) => Promise<{ data: TData; message: string }>,
  opts: { invalidate?: string[]; onSuccess?: (res: { data: TData; message: string }, vars: TVars) => void } = {}
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (res, vars) => {
      if (opts.invalidate?.length)
        await qc.invalidateQueries({
          predicate: query => {
            const first = query.queryKey[0];
            return typeof first === "string" && opts.invalidate!.some(p => first.startsWith(p));
          }
        });
      opts.onSuccess?.(res, vars);
    }
  });
}
