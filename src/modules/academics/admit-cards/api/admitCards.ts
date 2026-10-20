import { api } from "@/common/api";

/* An exam's admit cards (backend academics/admit-cards). Generating makes them match who is
   eligible today: cards for eligible students, withdrawn from those no longer eligible. */

export type AdmitCardStatus = "ISSUED" | "WITHDRAWN";

export type AdmitCardPaper = {
  subjectName: string;
  component: string | null;
  displayCode: string;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

export type AdmitCard = {
  id: string;
  examId: string;
  studentId: string;
  sectionId: string;
  status: AdmitCardStatus;
  issuedAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  /* What the card prints, as of the last generation */
  student: { firstName: string | null; lastName: string | null; admissionNumber: string | null; rollNumber: string | null; section: string };
  exam: { examName: string; startDate: string | null; endDate: string | null };
  papers: AdmitCardPaper[];
};

export type GenerateResult = { exam: { id: string; examName: string }; issued: number; refreshed: number; withdrawn: number; notEligible: number };

export const admitCardsPath = (examId: string) => `/academics/exams/${examId}/admit-cards`;

export const generateAdmitCards = ({ examId, sectionId }: { examId: string; sectionId?: string }) =>
  api.post<GenerateResult>(admitCardsPath(examId), sectionId ? { sectionId } : {});

export const downloadAdmitCard = (card: AdmitCard) => api.download(`${admitCardsPath(card.examId)}/${card.id}/pdf`, undefined, "admit-card.pdf");

/* Every issued card of a section, one per page */
export const downloadSectionAdmitCards = (examId: string, sectionId: string) => api.download(`${admitCardsPath(examId)}/pdf`, { sectionId }, "admit-cards.pdf");
