import { api } from "@/common/api";

/* A grade level (school-wide, shared across years) */
export type SchoolClass = {
  id: string;
  className: string;
  /* 1–50, unique: sorts the classes and numbers student codes */
  classOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassInput = { className: string; classOrder: number; description?: string };

export const CLASSES_PATH = "/academics/classes";

export const createClass = (body: ClassInput) => api.post<SchoolClass>(CLASSES_PATH, body);

/* All or nothing, at most 200 */
export const createClasses = (classes: ClassInput[]) => api.post<SchoolClass[]>(`${CLASSES_PATH}/bulk`, { classes });

/* description: "" clears it (the API refuses null) */
export const updateClass = ({ id, ...body }: Partial<ClassInput> & { id: string }) => api.patch<SchoolClass>(`${CLASSES_PATH}/${id}`, body);
