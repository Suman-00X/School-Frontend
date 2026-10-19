import { useEffect, useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { Button, Card, Checkbox, DescriptionList, Drawer, Field, MultiSelect, roleLabel, SkeletonBlock, StackedBar, TextInput, Textarea, useToast, ErrorState } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { ChannelIcons, ChannelPicker } from "../../shared/components/ChannelPicker";
import { AUDIENCE_ROLES, CHANNEL_META, CHANNELS, type AudienceRole, type Channel } from "../../shared/utils/channels";
import {
  ANNOUNCEMENTS_PATH,
  createAnnouncement,
  isEditable,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput
} from "../api/announcements";
import { AnnouncementStatusBadge, audienceScope, useAudienceOptions, useAuthorName } from "./audience";
import "./announcements.css";

const TITLE_MAX = 200;
const BODY_MAX = 5000;

type Values = { title: string; body: string; roles: AudienceRole[]; classIds: string[]; sectionIds: string[]; channels: Channel[] };

const EMPTY: Values = { title: "", body: "", roles: [], classIds: [], sectionIds: [], channels: ["IN_APP"] };

const toValues = (a: Announcement): Values => ({
  title: a.title,
  body: a.body,
  roles: [...a.audience.roles],
  classIds: [...a.audience.classIds],
  sectionIds: [...a.audience.sectionIds],
  channels: [...a.channels]
});

const toInput = (v: Values): AnnouncementInput => {
  const family = v.roles.includes("STUDENT") || v.roles.includes("PARENT");
  return {
    title: v.title.trim(),
    body: v.body.trim(),
    /* Classes and sections only narrow students and parents */
    audience: { roles: v.roles, classIds: family ? v.classIds : [], sectionIds: family ? v.sectionIds : [] },
    channels: v.channels.includes("IN_APP") ? v.channels : ["IN_APP", ...v.channels]
  };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* What changed, for PATCH */
function patchOf(before: AnnouncementInput, now: AnnouncementInput): Partial<AnnouncementInput> {
  const out: Partial<AnnouncementInput> = {};
  if (now.title !== before.title) out.title = now.title;
  if (now.body !== before.body) out.body = now.body;
  if (!same([...now.audience.roles].sort(), [...before.audience.roles].sort()) || !same(now.audience.classIds, before.audience.classIds) || !same(now.audience.sectionIds, before.audience.sectionIds))
    out.audience = now.audience;
  if (!same([...now.channels].sort(), [...before.channels].sort())) out.channels = now.channels;
  return out;
}

const FIELD_MAP = { "audience.roles": "roles", "audience.classIds": "classIds", "audience.sectionIds": "sectionIds" };

/* CO-01 drawer. `id` null with `creating` opens the empty editor. A draft or scheduled
   announcement opens in the editor for people who may manage; anything else is read-only.
   `onPublish` hands the saved announcement to the publish dialog. */
export function AnnouncementDrawer({
  id,
  creating,
  onClose,
  onPublish,
  onDelete
}: {
  id: string | null;
  creating: boolean;
  onClose: () => void;
  onPublish: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
}) {
  const { can } = useAuth();
  const canManage = can("communication.announcements.manage");
  const detail = useApiGet<Announcement>(id ? `${ANNOUNCEMENTS_PATH}/${id}` : null);
  const open = creating || !!id;
  if (!open) return null;
  if (creating) return <Editor announcement={null} onClose={onClose} onPublish={onPublish} />;
  if (detail.error)
    return (
      <Drawer open onClose={onClose} title="Announcement">
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Drawer>
    );
  if (!detail.data)
    return (
      <Drawer open onClose={onClose} title="Announcement">
        <SkeletonBlock lines={8} />
      </Drawer>
    );
  const a = detail.data;
  if (canManage && isEditable(a)) return <Editor key={a.id + a.updatedAt} announcement={a} onClose={onClose} onPublish={onPublish} onDelete={onDelete} />;
  return <AnnouncementView a={a} onClose={onClose} />;
}

function Editor({
  announcement,
  onClose,
  onPublish,
  onDelete
}: {
  announcement: Announcement | null;
  onClose: () => void;
  onPublish: (a: Announcement) => void;
  onDelete?: (a: Announcement) => void;
}) {
  const toast = useToast();
  const form = useForm<Values>(announcement ? toValues(announcement) : EMPTY);
  const { values, errors } = form;
  const { classOptions, sectionOptions } = useAudienceOptions();
  const invalidate = [ANNOUNCEMENTS_PATH, "/communication/activity"];
  const create = useApiMutation(createAnnouncement, { invalidate });
  const update = useApiMutation(updateAnnouncement, { invalidate });
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);

  useEffect(() => {
    form.reset(announcement ? toValues(announcement) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement?.id]);

  const family = values.roles.includes("STUDENT") || values.roles.includes("PARENT");
  const input = toInput(values);
  const changes = announcement ? patchOf(toInput(toValues(announcement)), input) : null;
  const dirty = !announcement || Object.keys(changes ?? {}).length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "Give it a title";
    if (!values.body.trim()) e.body = "Write the announcement";
    if (!values.roles.length) e.roles = "Pick at least one group";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  /* Save (create or patch), then optionally open the publish dialog with the saved record */
  const save = async (then: "close" | "publish") => {
    form.setFormError(null);
    if (!validate()) return;
    setBusy(then === "publish" ? "publish" : "save");
    try {
      let saved = announcement;
      if (!announcement) {
        const res = await create.mutateAsync(input);
        saved = res.data;
        /* Also when publishing next: if the publish dialog is cancelled, the draft is kept */
        toast.success(then === "close" ? res.message : "Draft saved");
      } else if (dirty) {
        const res = await update.mutateAsync({ id: announcement.id, ...changes });
        saved = res.data;
        toast.success(then === "close" ? res.message : "Changes saved");
      }
      if (then === "publish" && saved) onPublish(saved);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        /* Published in the meantime */
        toast.error(err);
        onClose();
      } else form.setServerErrors(err, FIELD_MAP);
    } finally {
      setBusy(null);
    }
  };

  const toggleRole = (r: AudienceRole) => form.set("roles", values.roles.includes(r) ? values.roles.filter(x => x !== r) : [...values.roles, r]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save("close");
  };

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={announcement ? announcement.title : "New announcement"}
      subtitle={
        announcement && (
          <span className="row" style={{ gap: 6 }}>
            <AnnouncementStatusBadge status={announcement.status} />
            {announcement.status === "SCHEDULED" && announcement.publishAt && <span>Goes out {formatDateTime(announcement.publishAt)}. Edits are sent then.</span>}
          </span>
        )
      }
      footerStatus={form.formError}
      footer={
        <>
          {announcement && onDelete && (
            <Button variant="ghost" className="announcement-delete" onClick={() => onDelete(announcement)} disabled={!!busy}>
              Delete
            </Button>
          )}
          <Button type="submit" form="announcement-form" loading={busy === "save"} disabled={!!busy || !dirty}>
            {announcement ? "Save changes" : "Save draft"}
          </Button>
          <Button variant="primary" loading={busy === "publish"} disabled={!!busy} onClick={() => void save("publish")}>
            {announcement?.status === "SCHEDULED" ? "Publish or reschedule…" : "Publish…"}
          </Button>
        </>
      }
    >
      <form id="announcement-form" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Title" required autoFocus={!announcement} maxLength={TITLE_MAX} placeholder="e.g. School closed on Friday" {...form.text("title")} />
        <Textarea label="Announcement" required rows={8} maxLength={BODY_MAX} hint={`${values.body.length} / ${BODY_MAX} characters · plain text`} {...form.text("body")} />
        <Field label="Who gets it" required error={errors.roles} hint="Everyone with these roles">
          <div className="audience-roles" role="group" aria-label="Audience">
            {AUDIENCE_ROLES.map(r => (
              <Checkbox key={r} label={roleLabel(r)} checked={values.roles.includes(r)} onChange={() => toggleRole(r)} />
            ))}
          </div>
        </Field>
        {/* Always shown (disabled until students or parents are picked), so the form never shifts */}
        <div className="form-grid">
          <MultiSelect
            label="Only these classes"
            options={classOptions}
            value={values.classIds}
            onChange={v => form.set("classIds", v)}
            disabled={!family}
            noun="classes"
            placeholder={family ? "Whole school" : "For students and parents"}
            hint={family ? "Leave empty for the whole school (current year)" : "Pick Student or Parent to narrow by class"}
            error={errors.classIds}
          />
          <MultiSelect
            label="Only these sections"
            options={sectionOptions}
            value={values.sectionIds}
            onChange={v => form.set("sectionIds", v)}
            disabled={!family}
            noun="sections"
            placeholder={family ? "Whole school" : "For students and parents"}
            hint={family ? "Leave empty for the whole school (current year)" : "Pick Student or Parent to narrow by section"}
            error={errors.sectionIds}
          />
        </div>
        <ChannelPicker value={values.channels} onChange={v => form.set("channels", v)} error={errors.channels} />
      </form>
    </Drawer>
  );
}

const DELIVERY_SEGMENTS = [
  { key: "SENT", label: "Sent", color: "var(--success)" },
  { key: "PENDING", label: "Pending", color: "var(--warning)" },
  { key: "FAILED", label: "Failed", color: "var(--danger)" },
  { key: "SKIPPED", label: "Skipped", color: "var(--text-3)" }
] as const;

/* Read-only: published announcements, and readers without manage */
function AnnouncementView({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const names = useAudienceOptions();
  const author = useAuthorName()(a.createdBy);
  const scope = audienceScope(a, names);
  return (
    <Drawer open wide onClose={onClose} title={a.title} subtitle={<AnnouncementStatusBadge status={a.status} />}>
      <div className="stack">
        <p className="announcement-body">{a.body}</p>
        <DescriptionList
          items={[
            { label: "Audience", value: a.audience.roles.map(roleLabel).join(", ") },
            { label: "Students and parents in", value: scope, hidden: !scope },
            { label: "Channels", value: <ChannelIcons channels={a.channels} /> },
            { label: "Published", value: formatDateTime(a.publishedAt), hidden: a.status !== "PUBLISHED" },
            { label: "Scheduled for", value: formatDateTime(a.publishAt), hidden: a.status !== "SCHEDULED" },
            { label: "Recipients", value: a.recipientCount, hidden: a.status !== "PUBLISHED" },
            { label: "Written by", value: author, hidden: !author },
            { label: "Created", value: formatDateTime(a.createdAt) }
          ]}
        />
        {a.status === "PUBLISHED" && (
          <Card title="Delivery" subtitle={a.delivery ? `${a.delivery.recipients} recipient${a.delivery.recipients === 1 ? "" : "s"}` : undefined}>
            {a.delivery && Object.keys(a.delivery.channels).length ? (
              <div className="stack">
                {CHANNELS.filter(c => a.delivery!.channels[c]).map(c => {
                  const counts = a.delivery!.channels[c]!;
                  return (
                    <div key={c} className="stack-sm">
                      <strong className="small">{CHANNEL_META[c].label}</strong>
                      <StackedBar ariaLabel={`${CHANNEL_META[c].label} delivery`} segments={DELIVERY_SEGMENTS.map(s => ({ ...s, value: counts[s.key] }))} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Nobody was in the audience when it was sent.</p>
            )}
          </Card>
        )}
      </div>
    </Drawer>
  );
}
