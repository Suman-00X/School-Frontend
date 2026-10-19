/* The signed-in session, kept in localStorage so every tab shares the newest refresh token */

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type SchoolRef = { id: string; name: string; code: string };

export type Session = {
  accessToken: string;
  /* epoch ms */
  accessExpiresAt: number;
  refreshToken: string;
  user: SessionUser;
  school: SchoolRef;
};

const SESSION_KEY = "school.session";
const SCHOOL_CODE_KEY = "school.lastSchoolCode";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the session lives for this page only */
  }
};

let memory: Session | null = null;

export const sessionStore = {
  get(): Session | null {
    const raw = read(SESSION_KEY);
    if (!raw) return memory;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },
  set(session: Session) {
    memory = session;
    write(SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    memory = null;
    write(SESSION_KEY, null);
  },
  /* Remembered on the device for the sign-in form (convenience only) */
  get lastSchoolCode() {
    return read(SCHOOL_CODE_KEY) ?? "";
  },
  set lastSchoolCode(code: string) {
    write(SCHOOL_CODE_KEY, code);
  }
};
