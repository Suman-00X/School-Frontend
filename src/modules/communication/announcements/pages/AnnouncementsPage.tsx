import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Megaphone, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Menu, MenuItem, Page, Tabs, useConfirm, useToast, type Column } from "@/common/ui";
import { formatDateTime, relativeTime } from "@/common/utils/format";
import { PageIntro } from "../../shared/components/PageIntro";
import { ChannelIcons } from "../../shared/components/ChannelPicker";
import { ANNOUNCEMENTS_PATH, deleteAnnouncement, isEditable, type Announcement } from "../api/announcements";
import { AnnouncementDrawer } from "../components/AnnouncementDrawer";
import { AnnouncementStatusBadge, AudienceBadges, audienceScope, useAudienceOptions } from "../components/audience";
import { PublishDialog } from "../components/PublishDialog";
import "../components/announcements.css";

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "DRAFT", label: "Drafts" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "PUBLISHED", label: "Published" }
];

const EMPTY_TITLES: Record<string, string> = {
  DRAFT: "No drafts",
  SCHEDULED: "Nothing scheduled",
  PUBLISHED: "Nothing published yet"
};

/* CO-01 · Announcements: school news to roles, classes or sections. Drafts and scheduled ones
   can be edited; publishing fans them out to every recipient's inbox (and email or SMS). */
export default function AnnouncementsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = can("communication.announcements.manage");
  const { params, setParam, setPage } = useListParams({ status: "" });
  const list = useApiList<Announcement>(ANNOUNCEMENTS_PATH, { status: params.status || undefined, page: params.page, limit: params.limit });
  const names = useAudienceOptions();
  const [search, setSearch] = useSearchParams();
  /* ?new=1 (the quick-add shortcut) opens the empty editor */
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const wantsNew = canManage && search.get("new") === "1";
  useEffect(() => {
    if (wantsNew) setCreating(true);
  }, [wantsNew]);
  const [publishing, setPublishing] = useState<Announcement | null>(null);
  const remove = useApiMutation(deleteAnnouncement, { invalidate: [ANNOUNCEMENTS_PATH, "/communication/activity"] });

  const startNew = () => setCreating(true);
  const closeDrawer = () => {
    setOpenId(null);
    setCreating(false);
    if (search.has("new"))
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete("new");
          return next;
        },
        { replace: true }
      );
  };

  const askDelete = async (a: Announcement) => {
    const ok = await confirm({
      title: `Delete “${a.title}”?`,
      message: a.status === "SCHEDULED" ? "It won't be sent. This cannot be undone." : "This cannot be undone.",
      confirmLabel: "Delete"
    });
    if (!ok) return;
    remove.mutate(a.id, {
      onSuccess: res => {
        toast.success(res.message || "Announcement deleted");
        closeDrawer();
      },
      onError: e => toast.error(e)
    });
  };

  const rowActions = (a: Announcement) => {
    if (!canManage || !isEditable(a)) return null;
    return (
      <div className="row-actions" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setOpenId(a.id)} aria-label={`Edit ${a.title}`} title="Edit" />
        <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${a.title}`} title="More" />}>
          {close => (
            <>
              <MenuItem
                icon={<Send />}
                onClick={() => {
                  close();
                  setPublishing(a);
                }}
              >
                {a.status === "SCHEDULED" ? "Publish or reschedule" : "Publish"}
              </MenuItem>
              <MenuItem
                icon={<Trash2 />}
                danger
                onClick={() => {
                  close();
                  void askDelete(a);
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    );
  };

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Announcement",
      render: a => (
        <div className="announcement-title-cell">
          <div style={{ fontWeight: 550 }} title={a.title}>
            {a.title}
          </div>
          <div className="small muted" title={a.body}>
            {a.body.split("\n")[0]}
          </div>
        </div>
      )
    },
    {
      key: "audience",
      header: "Audience",
      render: a => {
        const scope = audienceScope(a, names);
        return (
          <div className="stack-sm" style={{ gap: 2 }}>
            <AudienceBadges roles={a.audience.roles} />
            {scope && scope !== "Whole school" && <span className="small muted">{scope}</span>}
          </div>
        );
      }
    },
    { key: "channels", header: "Channels", render: a => <ChannelIcons channels={a.channels} /> },
    { key: "status", header: "Status", render: a => <AnnouncementStatusBadge status={a.status} /> },
    {
      key: "when",
      header: "Sent / scheduled",
      render: a => {
        const at = a.status === "PUBLISHED" ? a.publishedAt : a.status === "SCHEDULED" ? a.publishAt : null;
        return at ? (
          <span className="nowrap" title={formatDateTime(at)}>
            {a.status === "SCHEDULED" ? formatDateTime(at) : relativeTime(at)}
          </span>
        ) : (
          <span className="muted">—</span>
        );
      }
    },
    { key: "recipientCount", header: "Recipients", align: "right", render: a => (a.status === "PUBLISHED" ? a.recipientCount : <span className="muted">—</span>) },
    { key: "actions", header: "", align: "right", width: 84, render: rowActions }
  ];

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={startNew}>
      New announcement
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>School news for staff, students and parents. Published announcements land in everyone's inbox.</PageIntro>
      <Card flush>
        <div className="list-tabs">
          <Tabs tabs={STATUS_TABS} value={params.status} onChange={id => setParam("status", id)} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={a => setOpenId(a.id)}
          columns={columns}
          empty={
            params.status ? (
              <EmptyState icon={<Megaphone />} title={EMPTY_TITLES[params.status] ?? "Nothing here"} />
            ) : (
              <EmptyState icon={<Megaphone />} title="No announcements yet" message="Create one to notify staff, students or parents." actions={newButton} />
            )
          }
        />
      </Card>
      <AnnouncementDrawer id={openId} creating={creating} onClose={closeDrawer} onPublish={setPublishing} onDelete={a => void askDelete(a)} />
      <PublishDialog announcement={publishing} onClose={() => setPublishing(null)} />
    </Page>
  );
}
