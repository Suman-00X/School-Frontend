import { CalendarX2, School, UserX } from "lucide-react";
import { isApiError } from "@/common/api";
import { EmptyState, ErrorState } from "@/common/ui";

/* What a child page shows when its call fails. The portal's 404s mean different things:
   "Student not found" (not your child), or no enrollment this year; a 422 usually means the
   school has no current year yet. Nothing is retried automatically. */
export function PortalError({ error, onRetry, notEnrolled = "Not enrolled this year" }: { error: unknown; onRetry?: () => void; notEnrolled?: string }) {
  if (isApiError(error)) {
    if (error.status === 404 && /^student not found/i.test(error.message)) return <NotLinked />;
    if (error.status === 404 && /enrollment/i.test(error.message))
      return <EmptyState icon={<School />} title={notEnrolled} message="This page fills in once the school enrolls the student in a section." />;
    if (error.status === 422 && /academic year/i.test(error.message))
      return <EmptyState icon={<CalendarX2 />} title="The school has not set up this year yet" message="Please check again later." />;
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

export function NotLinked() {
  return (
    <EmptyState
      icon={<UserX />}
      title="This student is not linked to your account"
      message="Pick one of your students in the list, or contact the school office if someone is missing."
    />
  );
}

/* A short line for a card that failed on its own (the rest of the page still works) */
export function cardErrorText(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 404 && /enrollment/i.test(error.message)) return "Not enrolled this year.";
    if (error.status === 422 && /academic year/i.test(error.message)) return "The school has not set up this year yet.";
    if (error.status === 403) return "You don't have access to this.";
    if (error.status < 500) return error.message;
  }
  return "Couldn't load this. Try again later.";
}
