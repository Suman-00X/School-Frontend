import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation } from "@/common/hooks";
import { Button, EmptyState, SkeletonBlock, useToast } from "@/common/ui";
import { INBOX_KEY, INBOX_PATH, markAllRead, UNREAD_PATH, useUnreadCount, type Notification } from "../api/notifications";
import { NotificationDrawer, NotificationRow, useOpenNotification } from "./NotificationList";
import "./notifications.css";

/* SH-04 badge + SH-06 dropdown: the unread count on a bell in the shell header; it opens the
   latest five notifications, "Mark all read" and "See all". */
export function NotificationBell() {
  const { can } = useAuth();
  if (!can(INBOX_KEY)) return null;
  return <BellMenu />;
}

function BellMenu() {
  const toast = useToast();
  const unread = useUnreadCount() ?? 0;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const latest = useApiList<Notification>(INBOX_PATH, { page: 1, limit: 5 }, { enabled: open });
  const readAll = useApiMutation(markAllRead, { invalidate: [INBOX_PATH, UNREAD_PATH] });
  const openOne = useOpenNotification(setDetail, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="bell-button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}>
        <Bell />
        {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="Latest notifications">
          <div className="bell-pop-header">
            <strong>Notifications</strong>
            <Button
              size="sm"
              variant="ghost"
              loading={readAll.isPending}
              disabled={unread === 0}
              onClick={() => readAll.mutate(undefined, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) })}
            >
              Mark all read
            </Button>
          </div>
          <div className="bell-pop-body">
            {latest.isLoading ? (
              <div style={{ padding: 14 }}>
                <SkeletonBlock lines={6} />
              </div>
            ) : latest.error ? (
              <EmptyState title="Couldn't load your notifications" actions={<Button size="sm" onClick={() => void latest.refetch()}>Try again</Button>} />
            ) : !latest.rows?.length ? (
              <EmptyState icon={<BellOff />} title="You're all caught up" />
            ) : (
              <ul className="notif-list">
                {latest.rows.map(n => (
                  <NotificationRow key={n.id} n={n} onOpen={openOne} compact />
                ))}
              </ul>
            )}
          </div>
          <div className="bell-pop-footer">
            <span className="small muted">{unread ? `${unread} unread` : "No unread notifications"}</span>
            <Link to="/me/notifications" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>
        </div>
      )}
      <NotificationDrawer n={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
