import { useNavigate } from "react-router-dom";
import { Mail, MailOpen } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Button, DescriptionList, Drawer, ButtonLink, useToast } from "@/common/ui";
import { formatDateTime, relativeTime } from "@/common/utils/format";
import { INBOX_PATH, markNotification, UNREAD_PATH, type Notification } from "../api/notifications";
import { notificationTarget, TYPE_META } from "../utils/types";
import "./notifications.css";

/* Marking read or unread refreshes the inbox lists and the badge */
export function useMarkNotification() {
  return useApiMutation(markNotification, { invalidate: [INBOX_PATH, UNREAD_PATH] });
}

/* Clicking a notification marks it read, then opens its page (or the detail drawer) */
export function useOpenNotification(onDetail: (n: Notification) => void, after?: () => void) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const mark = useMarkNotification();
  return (n: Notification) => {
    if (!n.readAt) mark.mutate({ id: n.id, read: true });
    after?.();
    const to = notificationTarget(n, can);
    if (to) navigate(to);
    else onDetail(n.readAt ? n : { ...n, readAt: new Date().toISOString() });
  };
}

export function NotificationIcon({ n }: { n: Notification }) {
  const Icon = TYPE_META[n.type]?.icon ?? Mail;
  return (
    <span className="notif-icon" aria-hidden="true">
      <Icon />
    </span>
  );
}

/* One row: unread dot, icon by type, title (bold while unread), first line of the body, time */
export function NotificationRow({
  n,
  onOpen,
  onToggleRead,
  compact
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onToggleRead?: (n: Notification) => void;
  compact?: boolean;
}) {
  const unread = !n.readAt;
  return (
    <li className={`notif-row${unread ? " is-unread" : ""}${compact ? " is-compact" : ""}`}>
      <button type="button" className="notif-main" onClick={() => onOpen(n)}>
        <span className="notif-dot" aria-label={unread ? "Unread" : undefined} />
        <NotificationIcon n={n} />
        <span className="notif-text">
          <span className="notif-title" title={n.title}>
            {n.title}
          </span>
          <span className="notif-body" title={n.body}>
            {n.body.split("\n")[0]}
          </span>
          <span className="notif-meta">
            {TYPE_META[n.type]?.label ?? n.type} · <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}</time>
          </span>
        </span>
      </button>
      {onToggleRead && (
        <Button
          size="sm"
          variant="ghost"
          className="notif-toggle"
          icon={unread ? <MailOpen /> : <Mail />}
          onClick={() => onToggleRead(n)}
          aria-label={unread ? `Mark “${n.title}” as read` : `Mark “${n.title}” as unread`}
          title={unread ? "Mark as read" : "Mark as unread"}
        />
      )}
    </li>
  );
}

/* The full notification, for types that have no page to open */
export function NotificationDrawer({ n, onClose }: { n: Notification | null; onClose: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const mark = useMarkNotification();
  if (!n) return null;
  const target = notificationTarget(n, can);
  return (
    <Drawer
      open
      onClose={onClose}
      title={n.title}
      subtitle={`${TYPE_META[n.type]?.label ?? n.type} · ${formatDateTime(n.createdAt)}`}
      footer={
        <>
          <Button
            loading={mark.isPending}
            onClick={() =>
              mark.mutate(
                { id: n.id, read: false },
                {
                  onSuccess: res => {
                    toast.success(res.message);
                    onClose();
                  },
                  onError: e => toast.error(e)
                }
              )
            }
          >
            Mark as unread
          </Button>
          {target ? (
            <ButtonLink variant="primary" to={target} onClick={onClose}>
              Open
            </ButtonLink>
          ) : (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <p className="notif-full-body">{n.body}</p>
        <DescriptionList
          columns={1}
          items={[
            { label: "Received", value: formatDateTime(n.createdAt) },
            { label: "Read", value: n.readAt ? formatDateTime(n.readAt) : "Not yet" }
          ]}
        />
      </div>
    </Drawer>
  );
}
