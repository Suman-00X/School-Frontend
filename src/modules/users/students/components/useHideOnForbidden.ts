import { useEffect } from "react";
import { isApiError } from "@/common/api";

/* A tab whose read is refused (e.g. results for a teacher who isn't the class teacher) asks to be hidden */
export function useHideOnForbidden(error: unknown, onForbidden?: () => void) {
  const forbidden = isApiError(error) && error.status === 403;
  useEffect(() => {
    if (forbidden) onForbidden?.();
  }, [forbidden, onForbidden]);
}
