import type { ClassMode, ClassRequest, PinnedClass, WeightKey } from "../api/scheduling";

/* The generator's rules as the form holds them: strings for every Select and number field
   ("" = left out, the server's default), a key per row for React */

export type SubjectRow = {
  key: string;
  subjectId: string;
  /* Only in these sections ([] = wherever the subject is taught) */
  sectionIds: string[];
  /* Kept as sent before (the form doesn't edit them) */
  classIds?: string[];
  doublePeriods: string;
  maxPerDay: string;
  preferredPeriods: string[];
  avoidPeriods: string[];
  room: string;
};

export type AwayRow = { key: string; weekday: string; periodNumbers: string[] };
export type TeacherRow = { key: string; teacherId: string; maxPerDay: string; maxConsecutive: string; unavailable: AwayRow[] };
export type ClosedRow = { key: string; weekday: string; periodNumbers: string[]; sectionIds: string[]; classIds?: string[] };

export type ClassRules = {
  /* [] = every section of the year */
  sectionIds: string[];
  mode: ClassMode;
  teacherMaxPerDay: string;
  teacherMaxConsecutive: string;
  subjects: SubjectRow[];
  teachers: TeacherRow[];
  closed: ClosedRow[];
  /* Not edited here: carried over from an earlier draft's rules (e.g. an AI agent's) */
  pinned: PinnedClass[];
  weights: Record<WeightKey, string>;
  attempts: string;
  timeLimitMs: string;
  seed: string;
};

/* The solver's defaults, shown as placeholders */
export const WEIGHTS: { key: WeightKey; label: string; hint: string; fallback: number }[] = [
  { key: "spread", label: "Spread over the week", hint: "A subject's classes on different days", fallback: 10 },
  { key: "holes", label: "No free periods mid-day", hint: "For a section's day", fallback: 6 },
  { key: "adjacency", label: "No same subject twice in a row", hint: "Unless it is a double", fallback: 4 },
  { key: "preferences", label: "Preferred and avoided periods", hint: "The subject rules above", fallback: 3 },
  { key: "teacherGaps", label: "No idle periods for teachers", hint: "Between a teacher's classes", fallback: 2 },
  { key: "balance", label: "Days of similar length", hint: "For a section's week", fallback: 1 }
];

let seq = 0;
export const rowKey = () => `r${++seq}`;

export const EMPTY_RULES: ClassRules = {
  sectionIds: [],
  mode: "FILL",
  teacherMaxPerDay: "",
  teacherMaxConsecutive: "",
  subjects: [],
  teachers: [],
  closed: [],
  pinned: [],
  weights: { spread: "", adjacency: "", holes: "", balance: "", teacherGaps: "", preferences: "" },
  attempts: "",
  timeLimitMs: "",
  seed: ""
};

export const newSubjectRow = (): SubjectRow => ({ key: rowKey(), subjectId: "", sectionIds: [], doublePeriods: "", maxPerDay: "", preferredPeriods: [], avoidPeriods: [], room: "" });
export const newAwayRow = (): AwayRow => ({ key: rowKey(), weekday: "", periodNumbers: [] });
export const newTeacherRow = (): TeacherRow => ({ key: rowKey(), teacherId: "", maxPerDay: "", maxConsecutive: "", unavailable: [newAwayRow()] });
export const newClosedRow = (): ClosedRow => ({ key: rowKey(), weekday: "", periodNumbers: [], sectionIds: [] });

const str = (n: number | undefined) => (n === undefined || n === null ? "" : String(n));
const strs = (ns: number[] | undefined) => (ns ?? []).map(String);
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const nums = (ss: string[]) => (ss.length ? ss.map(Number).sort((a, b) => a - b) : undefined);
const list = (ss: string[] | undefined) => (ss && ss.length ? ss : undefined);

/* An earlier run's request -> the form (seed left out: a new draft gets a new one) */
export function rulesFrom(request: ClassRequest): ClassRules {
  const weights = { ...EMPTY_RULES.weights };
  for (const w of WEIGHTS) weights[w.key] = str(request.weights?.[w.key]);
  return {
    sectionIds: request.sectionIds ?? [],
    mode: request.mode ?? "FILL",
    teacherMaxPerDay: str(request.teacherMaxPerDay),
    teacherMaxConsecutive: str(request.teacherMaxConsecutive),
    subjects: (request.subjects ?? []).map(s => ({
      key: rowKey(),
      subjectId: s.subjectId,
      sectionIds: s.sectionIds ?? [],
      classIds: s.classIds,
      doublePeriods: s.doublePeriods ? String(s.doublePeriods) : "",
      maxPerDay: str(s.maxPerDay),
      preferredPeriods: strs(s.preferredPeriods),
      avoidPeriods: strs(s.avoidPeriods),
      room: s.room ?? ""
    })),
    teachers: (request.teachers ?? []).map(t => ({
      key: rowKey(),
      teacherId: t.teacherId,
      maxPerDay: str(t.maxPerDay),
      maxConsecutive: str(t.maxConsecutive),
      unavailable: (t.unavailable ?? []).map(u => ({ key: rowKey(), weekday: String(u.weekday), periodNumbers: strs(u.periodNumbers) }))
    })),
    closed: (request.closedPeriods ?? []).map(c => ({
      key: rowKey(),
      weekday: String(c.weekday),
      periodNumbers: strs(c.periodNumbers),
      sectionIds: c.sectionIds ?? [],
      classIds: c.classIds
    })),
    pinned: request.pinned ?? [],
    weights,
    attempts: str(request.attempts),
    timeLimitMs: str(request.timeLimitMs),
    seed: ""
  };
}

/* The form -> POST …/class-timetable/runs (only what was set) */
export function requestFrom(rules: ClassRules): ClassRequest {
  const body: ClassRequest = { mode: rules.mode };
  if (rules.sectionIds.length) body.sectionIds = rules.sectionIds;
  if (num(rules.teacherMaxPerDay)) body.teacherMaxPerDay = num(rules.teacherMaxPerDay);
  if (num(rules.teacherMaxConsecutive)) body.teacherMaxConsecutive = num(rules.teacherMaxConsecutive);
  const subjects = rules.subjects
    .filter(s => s.subjectId)
    .map(s => ({
      subjectId: s.subjectId,
      sectionIds: list(s.sectionIds),
      classIds: list(s.classIds),
      doublePeriods: num(s.doublePeriods),
      maxPerDay: num(s.maxPerDay),
      preferredPeriods: nums(s.preferredPeriods),
      avoidPeriods: nums(s.avoidPeriods),
      room: s.room.trim() || undefined
    }));
  if (subjects.length) body.subjects = subjects;
  const teachers = rules.teachers
    .filter(t => t.teacherId)
    .map(t => ({
      teacherId: t.teacherId,
      maxPerDay: num(t.maxPerDay),
      maxConsecutive: num(t.maxConsecutive),
      unavailable: t.unavailable.filter(u => u.weekday).map(u => ({ weekday: Number(u.weekday), periodNumbers: nums(u.periodNumbers) }))
    }));
  if (teachers.length) body.teachers = teachers;
  const closed = rules.closed
    .filter(c => c.weekday)
    .map(c => ({ weekday: Number(c.weekday), periodNumbers: nums(c.periodNumbers), sectionIds: list(c.sectionIds), classIds: list(c.classIds) }));
  if (closed.length) body.closedPeriods = closed;
  if (rules.pinned.length) body.pinned = rules.pinned;
  const weights: Partial<Record<WeightKey, number>> = {};
  for (const w of WEIGHTS) if (rules.weights[w.key].trim() !== "") weights[w.key] = Number(rules.weights[w.key]);
  if (Object.keys(weights).length) body.weights = weights;
  if (num(rules.attempts)) body.attempts = num(rules.attempts);
  if (num(rules.timeLimitMs)) body.timeLimitMs = num(rules.timeLimitMs);
  if (rules.seed.trim() !== "") body.seed = Number(rules.seed);
  return body;
}

/* Problems the form can see before sending, keyed like "subjects.<rowKey>.subjectId" */
export function validateRules(rules: ClassRules): Record<string, string> {
  const e: Record<string, string> = {};
  const whole = (s: string, min: number, max: number) => s.trim() === "" || (Number.isInteger(Number(s)) && Number(s) >= min && Number(s) <= max);
  for (const s of rules.subjects) {
    if (!s.subjectId) e[`subjects.${s.key}.subjectId`] = "Pick the subject";
    const both = s.preferredPeriods.filter(p => s.avoidPeriods.includes(p));
    if (both.length) e[`subjects.${s.key}.avoidPeriods`] = `Period ${both.join(", ")} is also preferred`;
    if (s.room.length > 30) e[`subjects.${s.key}.room`] = "At most 30 characters";
  }
  const seen = new Set<string>();
  for (const t of rules.teachers) {
    if (!t.teacherId) e[`teachers.${t.key}.teacherId`] = "Pick the teacher";
    else if (seen.has(t.teacherId)) e[`teachers.${t.key}.teacherId`] = "This teacher already has rules above";
    seen.add(t.teacherId);
    for (const u of t.unavailable) if (!u.weekday && u.periodNumbers.length) e[`teachers.${t.key}.${u.key}.weekday`] = "Pick the day";
  }
  for (const c of rules.closed) if (!c.weekday) e[`closed.${c.key}.weekday`] = "Pick the day";
  const inRange = (s: string) => s.trim() === "" || (Number(s) >= 0 && Number(s) <= 100);
  for (const w of WEIGHTS) if (!inRange(rules.weights[w.key])) e[`weights.${w.key}`] = "From 0 to 100";
  if (!whole(rules.attempts, 1, 40)) e.attempts = "From 1 to 40";
  if (!whole(rules.seed, 0, 2 ** 31 - 1)) e.seed = "A whole number, 0 or more";
  return e;
}

export const ruleCount = (rules: ClassRules) =>
  rules.subjects.length + rules.teachers.length + rules.closed.length + (rules.teacherMaxPerDay ? 1 : 0) + (rules.teacherMaxConsecutive ? 1 : 0);
