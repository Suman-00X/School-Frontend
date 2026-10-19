import { useCallback } from "react";
import { useAuth } from "@/common/auth";

/* The child a parent last looked at, per account and device, so the portal's fixed links
   (/me/school/…) open that child again. A convenience only: the URL is what counts. */
const keyFor = (userId: string) => `school.portal.student.${userId}`;

export function useRememberedStudent() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const read = useCallback(() => {
    if (!userId) return null;
    try {
      return localStorage.getItem(keyFor(userId));
    } catch {
      return null;
    }
  }, [userId]);

  const remember = useCallback(
    (studentId: string) => {
      if (!userId) return;
      try {
        localStorage.setItem(keyFor(userId), studentId);
      } catch {
        /* storage blocked: the URL still holds the child */
      }
    },
    [userId]
  );

  return { read, remember };
}
