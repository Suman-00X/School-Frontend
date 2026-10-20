import { Sparkles } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ButtonLink } from "@/common/ui";
import { GENERATE_TIMETABLE_PATH } from "../api/scheduling";

/* The Timetables page's way into the generator (AC-07b) */
export function GenerateTimetableLink() {
  const { can } = useAuth();
  if (!can("academics.scheduling.read")) return null;
  return (
    <ButtonLink icon={<Sparkles />} to={GENERATE_TIMETABLE_PATH}>
      Generate timetable
    </ButtonLink>
  );
}
