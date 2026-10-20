import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, UserX } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { SUMMARY_PATH, type CoverSummary } from "../api/substitutions";
import { dayName } from "../utils/dates";
import { SubstitutionOverlay } from "./SubstitutionOverlay";
import "./substitutions.css";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* Home: periods of absent teachers still to plan today, highlighted; it goes away once every
   one is planned. With today done, a quieter line for the next working day. Opens the plan. */
export function SubstitutionHighlight() {
  const { can } = useAuth();
  const enabled = can("academics.substitutions.read");
  /* Periods end during the day, and others plan too: refresh every minute */
  const { data } = useQuery({
    queryKey: [SUMMARY_PATH],
    enabled,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => (await api.get<CoverSummary>(SUMMARY_PATH, undefined, { signal })).data
  });
  const [openOn, setOpenOn] = useState<string | null>(null);
  if (!enabled || !data) return null;

  const next = data.next;
  const banner =
    data.needed > 0 ? (
      <button type="button" className="cover-highlight" onClick={() => setOpenOn(data.date)}>
        <span className="cover-highlight-count">{data.needed}</span>
        <span className="cover-highlight-text">
          <strong>{data.needed === 1 ? "1 period needs" : `${data.needed} periods need`} a substitute today</strong>
          <span className="small">
            {plural(data.absentTeachers, "teacher")} away · unplanned periods become leisure periods
          </span>
        </span>
        <span className="cover-highlight-go">
          Plan substitutions <ChevronRight />
        </span>
      </button>
    ) : next && next.needed > 0 ? (
      <button type="button" className="cover-highlight is-quiet" onClick={() => setOpenOn(next.date)}>
        <UserX />
        <span className="cover-highlight-text">
          <strong>
            {dayName(next.date, data.date)}: {plural(next.needed, "period")} to plan
          </strong>
          <span className="small">{plural(next.absentTeachers, "teacher")} on leave</span>
        </span>
        <span className="cover-highlight-go">
          Plan <ChevronRight />
        </span>
      </button>
    ) : null;

  return (
    <>
      {banner}
      {openOn && <SubstitutionOverlay open initialDate={openOn} onClose={() => setOpenOn(null)} />}
    </>
  );
}
