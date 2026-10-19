import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* The fixed levels a class can be (GET /academics/classes/levels gives them in order) */
export type ClassLevel = "NURSERY" | "LKG" | "UKG" | `GRADE_${number}`;

/* A class: one level of the school (school-wide, shared across years). Its name and order come
   from the level (Nursery 1, LKG 2, UKG 3, Class n = n + 3) and are never typed. */
export type SchoolClass = {
  id: string;
  /* null for a class created before levels existed whose name matched none: it needs one */
  level: ClassLevel | null;
  className: string;
  classOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/* GET /academics/classes/levels rows: every level, with the class created for it */
export type LevelRow = {
  level: ClassLevel;
  className: string;
  classOrder: number;
  created: boolean;
  /* null when not created (or, for a teacher, not one of theirs) */
  classId: string | null;
};

export type ClassInput = { level: ClassLevel; description?: string };

export const CLASSES_PATH = "/academics/classes";
export const CLASS_LEVELS_PATH = `${CLASSES_PATH}/levels`;

/* How many levels there are (for placeholders while they load) */
export const LEVEL_COUNT = 15;

export const useClassLevels = () => useApiGet<LevelRow[]>(CLASS_LEVELS_PATH);

export const byClassOrder = (a: { classOrder: number }, b: { classOrder: number }) => a.classOrder - b.classOrder;

export const createClass = (body: ClassInput) => api.post<SchoolClass>(CLASSES_PATH, body);

/* All or nothing, at most 200 */
export const createClasses = (classes: ClassInput[]) => api.post<SchoolClass[]>(`${CLASSES_PATH}/bulk`, { classes });

/* The level changes only while the class has no sections (else 409). description: "" clears it. */
export const updateClass = ({ id, ...body }: Partial<ClassInput> & { id: string }) => api.patch<SchoolClass>(`${CLASSES_PATH}/${id}`, body);
