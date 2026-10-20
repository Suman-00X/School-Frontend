/* The system admin's session lives in an httpOnly cookie the page cannot read: the console
   learns who is signed in from GET /platform/auth/me. When a call answers 401 the session is
   over; the console listens here to send the admin back to sign-in, saying why. */

export type SystemAdmin = { id: string; name: string; email: string };

const listeners = new Set<() => void>();
let endedMessage: string | null = null;

export const consoleSession = {
  ended(message?: string) {
    endedMessage = message ?? null;
    listeners.forEach(fn => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  /* Why the last session ended (once) */
  takeEndedMessage() {
    const message = endedMessage;
    endedMessage = null;
    return message;
  }
};
