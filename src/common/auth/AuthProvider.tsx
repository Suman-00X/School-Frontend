import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, endSession, isApiError, onClientEvent, sessionStore, type Account, type AccessView, type Session } from "@/common/api";

export type Me = { role: string; account: Account; profile: Record<string, unknown> | null };

/* The body of POST /auth/login */
export type LoginResult = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: Session["user"];
  school: Session["school"];
};

/* "error": signed in, but the profile could not be loaded (network or server error) */
type Status = "loading" | "signedOut" | "ready" | "error";

export type AuthContextValue = {
  status: Status;
  session: Session | null;
  me: Me | null;
  access: AccessView | null;
  /* Why the last session ended (shown on the sign-in page) */
  endedMessage: string | null;
  bootError: unknown;
  /* Load the profile and access again (after a boot error) */
  retryBoot: () => void;
  can: (key: string) => boolean;
  canAny: (...keys: string[]) => boolean;
  isOwner: (module: string) => boolean;
  signIn: (result: LoginResult) => Promise<void>;
  signOut: () => Promise<void>;
  reloadAccess: () => Promise<void>;
  reloadMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_REFETCH_MS = 2 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(() => (sessionStore.get() ? "loading" : "signedOut"));
  const [session, setSession] = useState<Session | null>(() => sessionStore.get());
  const [me, setMe] = useState<Me | null>(null);
  const [access, setAccess] = useState<AccessView | null>(null);
  const [endedMessage, setEndedMessage] = useState<string | null>(null);
  const [bootError, setBootError] = useState<unknown>(null);
  const lastAccessFetch = useRef(0);

  const loadAccess = useCallback(async () => {
    lastAccessFetch.current = Date.now();
    const res = await api.get<AccessView>("/administration/access/me/access");
    setAccess(res.data);
  }, []);

  const loadMe = useCallback(async () => {
    const res = await api.get<Me>("/me");
    setMe(res.data);
  }, []);

  const boot = useCallback(async () => {
    setStatus("loading");
    setBootError(null);
    try {
      await Promise.all([loadMe(), loadAccess()]);
      setSession(sessionStore.get());
      setStatus(sessionStore.get() ? "ready" : "signedOut");
    } catch (e) {
      /* A 401 has already ended the session. Any other refusal (e.g. "School not found")
         means this session can't be used either; a network or server error can be retried. */
      if (!sessionStore.get()) setStatus("signedOut");
      else if (isApiError(e) && e.status < 500) endSession(e.message);
      else {
        setBootError(e);
        setStatus("error");
      }
    }
  }, [loadAccess, loadMe]);

  /* First load with a stored session */
  useEffect(() => {
    if (sessionStore.get()) void boot();
  }, [boot]);

  /* The client tells us when the session ends or a call was refused */
  useEffect(
    () =>
      onClientEvent(e => {
        if (e.type === "session-ended") {
          queryClient.clear();
          setSession(null);
          setMe(null);
          setAccess(null);
          setEndedMessage(e.message ?? null);
          setStatus("signedOut");
        } else if (e.type === "forbidden" && Date.now() - lastAccessFetch.current > 5_000) {
          void loadAccess().catch(() => undefined);
        }
      }),
    [loadAccess, queryClient]
  );

  /* Access changes apply on the next request: re-check when the window regains focus */
  useEffect(() => {
    const onFocus = () => {
      if (status === "ready" && Date.now() - lastAccessFetch.current > ACCESS_REFETCH_MS)
        void loadAccess().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadAccess, status]);

  /* Another tab signed in or out */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "school.session") return;
      if (!e.newValue) {
        queryClient.clear();
        setSession(null);
        setStatus("signedOut");
      } else if (!session) {
        void boot();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [boot, queryClient, session]);

  const signIn = useCallback(
    async (r: LoginResult) => {
      const next: Session = {
        accessToken: r.accessToken,
        accessExpiresAt: Date.now() + r.expiresIn * 1000,
        refreshToken: r.refreshToken,
        user: r.user,
        school: r.school
      };
      sessionStore.set(next);
      sessionStore.lastSchoolCode = r.school.code;
      setEndedMessage(null);
      setSession(next);
      await boot();
    },
    [boot]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* signing out locally is what matters */
    }
    endSession();
    setEndedMessage(null);
  }, []);

  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const m of access?.modules ?? [])
      for (const r of m.resources) for (const p of r.permissions) set.add(p.key);
    return set;
  }, [access]);

  const owners = useMemo(
    () => new Set((access?.modules ?? []).filter(m => m.owner).map(m => m.module)),
    [access]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      me,
      access,
      endedMessage,
      bootError,
      retryBoot: () => void boot(),
      can: key => keys.has(key),
      canAny: (...k) => k.some(key => keys.has(key)),
      isOwner: module => owners.has(module),
      signIn,
      signOut,
      reloadAccess: loadAccess,
      reloadMe: loadMe
    }),
    [status, session, me, access, endedMessage, bootError, boot, keys, owners, signIn, signOut, loadAccess, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
