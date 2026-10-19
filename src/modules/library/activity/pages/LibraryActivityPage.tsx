/* MA-01 · Module activity tab for the library: every change made in the library, by whom */
import { ActivityLog } from "@/common/components/activity-log";
import { LibraryIntro } from "../../shared/components/LibraryBits";

export default function LibraryActivityPage() {
  return (
    <div className="stack">
      <LibraryIntro>Who issued, returned, waived, edited or set up what in the library, including changes to its operators.</LibraryIntro>
      <ActivityLog basePath="/library/activity" module="library" />
    </div>
  );
}
