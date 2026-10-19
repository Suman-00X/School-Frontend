import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/common/hooks";

/* A search box bound to a URL param: typing updates the param after a pause, and a link that
   changes the param (back, a shared link) fills the box, without our own updates clobbering typing.
   const [search, setSearch] = useSearchBox(params.q, q => setParam("q", q)); */
export function useSearchBox(value: string, commit: (next: string) => void) {
  const [search, setSearch] = useState(value);
  const debounced = useDebounce(search, 300);
  const sent = useRef(value);

  useEffect(() => {
    const next = debounced.trim();
    sent.current = next;
    if (next !== value) commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setSearch(value);
    }
  }, [value]);

  return [search, setSearch] as const;
}
