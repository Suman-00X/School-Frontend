import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSystemAdmin, platformKeys } from "../api/schools";
import { consoleSession } from "../api/session";

/* The signed-in system admin (data: null when nobody is). A 401 from any console call ends it. */
export function useSystemAdmin() {
  const qc = useQueryClient();
  useEffect(() => consoleSession.subscribe(() => qc.setQueryData(platformKeys.me, null)), [qc]);
  return useQuery({ queryKey: platformKeys.me, queryFn: fetchSystemAdmin, retry: false, staleTime: 5 * 60_000 });
}
