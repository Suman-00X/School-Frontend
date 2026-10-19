import { Lock } from "lucide-react";
import { isApiError } from "@/common/api";
import { EmptyState, ErrorState } from "@/common/ui";

/* A profile tab whose read failed. A refusal (e.g. results for a teacher who isn't the class
   teacher) is said in place: the tab stays in the header instead of vanishing after a click. */
export function TabError({ error, what, onRetry }: { error: unknown; what: string; onRetry?: () => void }) {
  if (isApiError(error) && error.status === 403)
    return <EmptyState icon={<Lock />} title={`You can't see this student's ${what}`} message={error.message} />;
  return <ErrorState error={error} onRetry={onRetry} />;
}
