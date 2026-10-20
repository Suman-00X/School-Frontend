import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

export const NOTIFICATION_TYPES = [
  "ANNOUNCEMENT",
  "MESSAGE",
  "ATTENDANCE_ABSENT",
  "ATTENDANCE_MISSED",
  "RESULTS_PUBLISHED",
  "ADMIT_CARD_ISSUED",
  "INVOICE_ISSUED",
  "PAYMENT_RECEIVED",
  "REFUND_PROCESSED",
  "REFUND_REQUESTED",
  "REFUND_APPROVED",
  "REFUND_REJECTED",
  "FEE_REMINDER",
  "IMPORT_COMPLETED",
  "SUBSTITUTION"
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* GET /me/notifications rows (deliveries and the SMS text are left out by the API) */
export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /* Links for the app: studentId, invoiceId, examId, announcementId, importId, refundId… */
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export const INBOX_PATH = "/me/notifications";
export const UNREAD_PATH = "/me/notifications/unread-count";
export const INBOX_KEY = "communication.notifications.inbox";

export const markNotification = ({ id, read }: { id: string; read: boolean }) => api.patch<Notification>(`${INBOX_PATH}/${id}`, { read });

export const markAllRead = () => api.post<{ updated: number }>(`${INBOX_PATH}/read-all`);

/* The badge count. Polled every minute while the app is visible (there is no push channel). */
export function useUnreadCount() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: [UNREAD_PATH],
    enabled: can(INBOX_KEY),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => (await api.get<{ unread: number }>(UNREAD_PATH, undefined, { signal })).data.unread
  });
  return q.data;
}
