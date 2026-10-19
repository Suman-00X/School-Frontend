import { api } from "@/common/api";
import type { AudienceRole, Channel } from "../../shared/utils/channels";

export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export type DeliveryCounts = { PENDING: number; SENT: number; FAILED: number; SKIPPED: number };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: { roles: AudienceRole[]; classIds: string[]; sectionIds: string[] };
  channels: Channel[];
  status: AnnouncementStatus;
  /* Set when published or scheduled */
  publishAt?: string;
  publishedAt?: string;
  /* Known only after the fan-out */
  recipientCount: number;
  /* User id of the author (no name embedded) */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /* GET by id, published only */
  delivery?: { recipients: number; channels: Partial<Record<Channel, DeliveryCounts>> };
};

export type AnnouncementInput = {
  title: string;
  body: string;
  audience: { roles: AudienceRole[]; classIds: string[]; sectionIds: string[] };
  channels: Channel[];
};

export const ANNOUNCEMENTS_PATH = "/communication/announcements";

export const createAnnouncement = (body: AnnouncementInput) => api.post<Announcement>(ANNOUNCEMENTS_PATH, body);

export const updateAnnouncement = ({ id, ...body }: Partial<AnnouncementInput> & { id: string }) => api.patch<Announcement>(`${ANNOUNCEMENTS_PATH}/${id}`, body);

export const deleteAnnouncement = (id: string) => api.delete<null>(`${ANNOUNCEMENTS_PATH}/${id}`);

/* No publishAt publishes now; a future time schedules (or reschedules) it */
export const publishAnnouncement = ({ id, publishAt }: { id: string; publishAt?: string }) =>
  api.post<Announcement>(`${ANNOUNCEMENTS_PATH}/${id}/publication`, publishAt ? { publishAt } : {});

export const isEditable = (a: Pick<Announcement, "status">) => a.status !== "PUBLISHED";
