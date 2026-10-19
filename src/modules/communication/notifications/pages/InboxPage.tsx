import { useState } from "react";
import { BellOff, SearchX } from "lucide-react";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, Page, Pagination, Select, SkeletonBlock, useToast } from "@/common/ui";
import { INBOX_PATH, markAllRead, UNREAD_PATH, useUnreadCount, type Notification } from "../api/notifications";
import { NotificationDrawer, NotificationRow, useMarkNotification, useOpenNotification } from "../components/NotificationList";
import { TYPE_META, typesForRole } from "../utils/types";

/* SH-06 · Notification inbox: everything sent to the signed-in person, newest first.
   Reached from the bell in the header, so a drill-in page (back home) with All / Unread tabs. */
export default function InboxPage() {
  const { me, session } = useAuth();
  const toast = useToast();
  const { params, setParams, setParam, setPage } = useListParams({ view: "all", type: "" });
  const unreadOnly = params.view === "unread";
  const list = useApiList<Notification>(INBOX_PATH, {
    unread: unreadOnly ? "true" : undefined,
    type: params.type || undefined,
    page: params.page,
    limit: params.limit
  });
  const unread = useUnreadCount();
  const [detail, setDetail] = useState<Notification | null>(null);
  const mark = useMarkNotification();
  const readAll = useApiMutation(markAllRead, { invalidate: [INBOX_PATH, UNREAD_PATH] });
  const open = useOpenNotification(setDetail);

  const toggleRead = (n: Notification) =>
    mark.mutate({ id: n.id, read: !n.readAt }, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });

  const types = typesForRole(me?.role ?? session?.user.role);

  return (
    <Page>
      <DrillHeader
        back="/"
        backLabel="Back to home"
        title="Notifications"
        tabs={[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread", count: unread ?? undefined }
        ]}
        value={unreadOnly ? "unread" : "all"}
        onChange={id => setParams({ view: id })}
      />
      <Card flush>
        <div className="filter-bar" style={{ justifyContent: "space-between" }}>
          <Select
            label="Type"
            className="select-sm"
            value={params.type}
            placeholder="All types"
            options={types.map(t => ({ value: t, label: TYPE_META[t].label }))}
            onChange={e => setParam("type", e.target.value)}
          />
          <Button
            size="sm"
            loading={readAll.isPending}
            disabled={!unread}
            onClick={() => readAll.mutate(undefined, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) })}
          >
            Mark all read
          </Button>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isLoading && !list.rows ? (
          <div style={{ padding: 16 }}>
            <SkeletonBlock lines={8} />
          </div>
        ) : !list.rows?.length ? (
          <div className="table-empty">
            {params.type ? (
              <EmptyState icon={<SearchX />} title={`No ${TYPE_META[params.type as keyof typeof TYPE_META]?.label.toLowerCase() ?? ""} notifications${unreadOnly ? " unread" : ""}`} />
            ) : (
              <EmptyState icon={<BellOff />} title="You're all caught up" message={unreadOnly ? "Nothing unread." : "Nothing has been sent to you yet."} />
            )}
          </div>
        ) : (
          <ul className="notif-list" style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
            {list.rows.map(n => (
              <NotificationRow key={n.id} n={n} onOpen={open} onToggleRead={toggleRead} />
            ))}
          </ul>
        )}
        {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={setPage} />}
      </Card>
      <NotificationDrawer n={detail} onClose={() => setDetail(null)} />
    </Page>
  );
}
