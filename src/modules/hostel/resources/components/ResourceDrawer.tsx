import { useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import {
  PLAN_TYPES,
  RESOURCE_STATUS_LABELS,
  RESOURCE_STATUSES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPES,
  ROOM_ITEM_TYPES,
  resourceTypeLabel,
  type ResourceStatus,
  type ResourceType
} from "../../shared/utils/format";
import { useAllHostels } from "../../hostels/api/hostels";
import { ROOMS_PATH, type Room } from "../../rooms/api/rooms";
import { createResource, updateResource, type Resource, type ResourceInput, type ResourcePatch } from "../api/resources";

type Values = {
  resourceType: ResourceType | "";
  hostelId: string;
  roomId: string;
  name: string;
  customType: string;
  capacity: string;
  monthlyFee: string;
  status: ResourceStatus;
  description: string;
};

const EMPTY: Values = { resourceType: "", hostelId: "", roomId: "", name: "", customType: "", capacity: "", monthlyFee: "", status: "AVAILABLE", description: "" };

const TYPE_HINTS: Record<ResourceType, string> = {
  LOCKER: "In a room, or hostel-wide; one holder unless you say",
  CUPBOARD: "In a room, or hostel-wide; one holder unless you say",
  STUDY_TABLE: "In a room, or hostel-wide; one holder unless you say",
  MESS_PLAN: "Hostel-wide; a student is on one mess plan at a time",
  LAUNDRY_PLAN: "Hostel-wide; a student is on one laundry plan at a time",
  CUSTOM: "Anything else, such as a bicycle stand"
};

const toValues = (r: Resource): Values => ({
  resourceType: r.resourceType,
  hostelId: r.hostelId,
  roomId: r.roomId ?? "",
  name: r.name,
  customType: r.customType ?? "",
  capacity: String(r.capacity),
  monthlyFee: r.monthlyFee ? String(r.monthlyFee) : "",
  status: r.status,
  description: r.description ?? ""
});

function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  if (err.status === 409 && /named/i.test(err.message)) return "name";
  if (err.status === 422 && /hostel-wide|room/i.test(err.message)) return "roomId";
  if (/capacity|holders/i.test(err.message)) return "capacity";
  return null;
}

/* HO-03 drawer: add a resource (type first) or edit one (type, hostel and room are fixed) */
export function ResourceDrawer({ open, resource, canEdit, onClose }: { open: boolean; resource: Resource | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const form = useForm<Values>(EMPTY);
  const hostels = useAllHostels(open && !resource);
  const create = useApiMutation(createResource, { invalidate: ["/hostel"] });
  const update = useApiMutation(updateResource, { invalidate: ["/hostel"] });
  const { values, errors } = form;
  const type = values.resourceType;
  const isPlan = !!type && PLAN_TYPES.includes(type);
  const rooms = useApiList<Room>(ROOMS_PATH, { hostelId: values.hostelId, limit: 100 }, { enabled: open && !resource && !!values.hostelId && !isPlan && can("hostel.rooms.read") });

  useEffect(() => {
    if (open) form.reset(resource ? toValues(resource) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource?.id]);

  const before = resource ? toValues(resource) : null;
  const changes = (() => {
    if (!before) return null;
    const out: ResourcePatch = {};
    const name = values.name.trim().replace(/\s+/g, " ");
    if (name !== before.name) out.name = name;
    if (values.capacity.trim() !== before.capacity) out.capacity = Number(values.capacity);
    if (type === "CUSTOM" && values.customType.trim() !== before.customType) out.customType = values.customType.trim();
    if (values.monthlyFee.trim() !== before.monthlyFee) out.monthlyFee = values.monthlyFee.trim() ? Number(values.monthlyFee) : 0;
    if (values.status !== before.status) out.status = values.status;
    if (values.description.trim() !== before.description) out.description = values.description.trim();
    return out;
  })();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!type) e.resourceType = "Pick what it is";
    if (!values.hostelId) e.hostelId = "Pick the hostel";
    if (!values.name.trim()) e.name = "Name it, e.g. Locker A-12";
    if (type === "CUSTOM" && !values.customType.trim()) e.customType = "Say what it is, e.g. Bicycle stand";
    const cap = values.capacity.trim();
    if (!cap) {
      if (resource || (type && !ROOM_ITEM_TYPES.includes(type))) e.capacity = "How many students may hold it on one day";
    } else if (!Number.isInteger(Number(cap)) || Number(cap) < 1 || Number(cap) > 10000) e.capacity = "A whole number from 1 to 10,000";
    if (values.monthlyFee.trim()) {
      const fee = Number(values.monthlyFee);
      if (!Number.isFinite(fee) || fee < 0) e.monthlyFee = "0 or more";
      else if (Math.round(fee * 100) !== fee * 100) e.monthlyFee = "At most 2 decimals";
    }
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onError = (err: unknown) => {
    const field = fieldOf(err);
    if (field) {
      form.setErrors({ [field]: (err as Error).message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (!resource) {
      const body: ResourceInput = { hostelId: values.hostelId, resourceType: type as ResourceType, name: values.name.trim(), status: values.status };
      if (values.roomId && !isPlan) body.roomId = values.roomId;
      if (values.capacity.trim()) body.capacity = Number(values.capacity);
      if (type === "CUSTOM") body.customType = values.customType.trim();
      if (values.monthlyFee.trim()) body.monthlyFee = Number(values.monthlyFee);
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, { onSuccess: done, onError });
    } else if (changes && Object.keys(changes).length) update.mutate({ id: resource.id, ...changes }, { onSuccess: done, onError });
  };

  const place = resource ? `${resource.hostel.name} · ${resource.room ? `Room ${resource.room.roomNumber}` : "Hostel-wide"}` : undefined;
  const holdersLink = resource && can("hostel.resourceAssignments.read") && (
    <Link to={`/hostel/resource-assignments?resourceId=${resource.id}&phase=ALL`}>See who holds it</Link>
  );

  if (resource && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={resource.name} subtitle={place}>
        <div className="stack">
          <DescriptionList
            items={[
              { label: "Type", value: resourceTypeLabel(resource) },
              { label: "Status", value: RESOURCE_STATUS_LABELS[resource.status] },
              { label: "Holders at once", value: resource.capacity },
              { label: "Held today", value: `${resource.inUse} (${resource.available} free)` },
              { label: "Monthly fee", value: resource.monthlyFee ? formatMoney(resource.monthlyFee, currency) : null },
              { label: "Description", value: resource.description, wide: true }
            ]}
          />
          {holdersLink}
        </div>
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={resource ? resource.name : "New resource"}
      subtitle={place}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="resource-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!changes && !Object.keys(changes).length}>
            {resource ? "Save changes" : "Add resource"}
          </Button>
        </>
      }
    >
      <form id="resource-form" className="stack" onSubmit={submit} noValidate>
        {resource ? (
          <DescriptionList
            items={[
              { label: "Type", value: RESOURCE_TYPE_LABELS[resource.resourceType] },
              { label: "Held today", value: `${resource.inUse} of ${resource.capacity}` },
              { label: "Who holds it", value: holdersLink || null, hidden: !holdersLink }
            ]}
          />
        ) : (
          <>
            <Select
              label="Type"
              required
              value={type}
              onChange={e => {
                const t = e.target.value as ResourceType;
                form.set("resourceType", t);
                if (PLAN_TYPES.includes(t)) form.set("roomId", "");
              }}
              options={RESOURCE_TYPES.map(t => ({ value: t, label: RESOURCE_TYPE_LABELS[t], description: TYPE_HINTS[t] }))}
              placeholder="What is it?"
              error={errors.resourceType}
            />
            <div className="form-grid">
              <Select
                label="Hostel"
                required
                value={values.hostelId}
                onChange={e => {
                  form.set("hostelId", e.target.value);
                  form.set("roomId", "");
                }}
                options={(hostels.rows ?? []).map(h => ({ value: h.id, label: `${h.code} · ${h.name}` }))}
                placeholder={hostels.isLoading ? "Loading hostels…" : "Pick a hostel"}
                error={errors.hostelId}
              />
              {!isPlan ? (
                <Select
                  label="Room"
                  value={values.roomId}
                  onChange={e => form.set("roomId", e.target.value)}
                  options={(rooms.rows ?? []).map(r => ({ value: r.id, label: `Room ${r.roomNumber}`, description: r.roomType ?? undefined }))}
                  placeholder="Hostel-wide"
                  disabled={!values.hostelId}
                  error={errors.roomId}
                  hint="In a room: only its residents can have it"
                />
              ) : (
                <Field label="Room" hint="Plans are always hostel-wide">
                  <div className="input" aria-disabled style={{ display: "flex", alignItems: "center", color: "var(--text-3)" }}>
                    Hostel-wide
                  </div>
                </Field>
              )}
            </div>
          </>
        )}
        <div className="form-grid">
          <TextInput label="Name" required maxLength={100} placeholder={isPlan ? "e.g. Vegetarian mess plan" : "e.g. Locker A-12"} {...form.text("name")} />
          {type === "CUSTOM" ? (
            <TextInput label="What it is" required maxLength={50} placeholder="e.g. Bicycle stand" {...form.text("customType")} />
          ) : (
            <span />
          )}
          <TextInput
            label="Holders at once"
            type="number"
            inputMode="numeric"
            min={1}
            required={!!type && !ROOM_ITEM_TYPES.includes(type)}
            hint={type && ROOM_ITEM_TYPES.includes(type) ? "Blank: one student" : "How many students may hold it on one day"}
            {...form.text("capacity")}
          />
          <TextInput label={`Monthly fee (${currency})`} type="number" inputMode="decimal" min={0} step="0.01" hint="Stored for reference; not invoiced" {...form.text("monthlyFee")} />
        </div>
        <Field label="Status">
          <RadioGroup
            aria-label="Status"
            options={RESOURCE_STATUSES.map(s => ({ value: s, label: RESOURCE_STATUS_LABELS[s], description: s === "AVAILABLE" ? "Can be given out" : "Current holders keep it; nobody new" }))}
            value={values.status}
            onChange={v => form.set("status", v)}
          />
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
