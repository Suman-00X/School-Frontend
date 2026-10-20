/* The operator's session for the onboarding portal: one signed token, no refresh.
   Kept apart from the school session (another key, another token type), so signing in
   here never signs anyone in or out of a school. */

export type Operator = { id: string; name: string; email: string };

export type OperatorSession = { accessToken: string; expiresAt: number; operator: Operator };

const KEY = "school.platformSession";
const listeners = new Set<() => void>();

const read = (): OperatorSession | null => {
  try {
    const raw = localStorage.getItem(KEY);
    const session = raw ? (JSON.parse(raw) as OperatorSession) : null;
    return session && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
};

let current = read();
let endedMessage: string | null = null;

const notify = () => listeners.forEach(fn => fn());

export const operatorSession = {
  get: () => current,
  set(session: OperatorSession) {
    current = session;
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* storage blocked: the session lives for this page only */
    }
    notify();
  },
  /* `message`: why it ended, shown on the sign-in page */
  clear(message?: string) {
    current = null;
    endedMessage = message ?? null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing stored */
    }
    notify();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  get endedMessage() {
    return endedMessage;
  }
};

/* Another tab signed in or out */
if (typeof window !== "undefined")
  window.addEventListener("storage", e => {
    if (e.key !== KEY) return;
    current = read();
    notify();
  });
