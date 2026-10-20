import { api } from "@/common/api";

/* Subject codes (Academics › Setup › Policy): each class's place, the two middle digits of a class
   subject's code. MA221 = Mathematics (MA), stage 2, position 2, required (1; optional is 0). */

export type CodeSlot = {
  classId: string;
  className: string;
  level: string | null;
  classOrder: number;
  /* null: no place yet (its level's default was taken); subjects can't be added until it has one */
  stage: number | null;
  position: number | null;
  defaultStage: number | null;
  defaultPosition: number | null;
  /* Its codes are used by exam papers, assessments or an archived year: the place is fixed */
  locked: boolean;
};

export type SlotInput = { classId: string; stage: number; position: number };

export const SUBJECT_CODE_SLOTS_PATH = "/academics/subject-codes/slots";

export const saveCodeSlots = (slots: SlotInput[]) => api.put<CodeSlot[]>(SUBJECT_CODE_SLOTS_PATH, { slots });

/* 1–9 each */
export const SLOT_DIGITS = Array.from({ length: 9 }, (_, i) => i + 1);

export const placeLabel = (stage: number | null, position: number | null) => (stage && position ? `${stage}-${position}` : "—");
