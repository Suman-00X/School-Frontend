import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { RoomStatusBadge } from "../../shared/components/Badges";
import { floorLabel, ROOM_STATUS_LABELS, ROOM_STATUSES, type RoomStatus } from "../../shared/utils/format";
import { createRoom, updateRoom, type Room, type RoomInput } from "../api/rooms";

type Values = { roomNumber: string; floor: string; capacity: string; roomType: string; monthlyFee: string; status: RoomStatus; description: string };

const EMPTY: Values = { roomNumber: "", floor: "", capacity: "", roomType: "", monthlyFee: "", status: "AVAILABLE", description: "" };

const toValues = (r: Room): Values => ({
  roomNumber: r.roomNumber,
  floor: r.floor === null ? "" : String(r.floor),
  capacity: String(r.capacity),
  roomType: r.roomType ?? "",
  monthlyFee: r.monthlyFee ? String(r.monthlyFee) : "",
  status: r.status,
  description: r.description ?? ""
});

const STATUS_OPTIONS = ROOM_STATUSES.map(s => ({
  value: s,
  label: ROOM_STATUS_LABELS[s],
  description: s === "AVAILABLE" ? "Takes residents" : s === "MAINTENANCE" ? "Keeps its residents, takes no new ones" : "No residents now or later"
}));

/* Refusals that belong to one field */
function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  if (err.status === 409 && /already exists/i.test(err.message)) return "roomNumber";
  if (err.status === 409 && /capacity/i.test(err.message)) return "capacity";
  if (err.status === 409 && /closing/i.test(err.message)) return "status";
  return null;
}

/* HO-01 room drawer: add a room to a hostel (room = null) or edit one. Readers see it read-only. */
export function RoomDrawer({
  open,
  hostelId,
  room,
  roomTypes,
  canEdit,
  onClose
}: {
  open: boolean;
  hostelId: string;
  room: Room | null;
  /* Types already used in the hostel, offered in the type field */
  roomTypes: string[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const form = useForm<Values>(EMPTY);
  const create = useApiMutation(createRoom, { invalidate: ["/hostel"] });
  const update = useApiMutation(updateRoom, { invalidate: ["/hostel"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(room ? toValues(room) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room?.id]);

  const before = room ? toValues(room) : null;
  const changes = (() => {
    if (!before) return null;
    const out: Partial<Omit<RoomInput, "hostelId">> = {};
    const num = values.roomNumber.trim().replace(/\s+/g, " ").toUpperCase();
    if (num !== before.roomNumber) out.roomNumber = num;
    if (values.floor.trim() !== before.floor && values.floor.trim() !== "") out.floor = Number(values.floor);
    if (values.capacity.trim() !== before.capacity) out.capacity = Number(values.capacity);
    if (values.roomType.trim() !== before.roomType) out.roomType = values.roomType.trim();
    if (values.monthlyFee.trim() !== before.monthlyFee) out.monthlyFee = values.monthlyFee.trim() ? Number(values.monthlyFee) : 0;
    if (values.status !== before.status) out.status = values.status;
    if (values.description.trim() !== before.description) out.description = values.description.trim();
    return out;
  })();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.roomNumber.trim()) e.roomNumber = "Enter the room number";
    const cap = Number(values.capacity);
    if (!values.capacity.trim()) e.capacity = "How many beds";
    else if (!Number.isInteger(cap) || cap < 1 || cap > 50) e.capacity = "A whole number from 1 to 50";
    if (values.floor.trim()) {
      const f = Number(values.floor);
      if (!Number.isInteger(f) || f < -5 || f > 200) e.floor = "A whole number (0 is the ground floor)";
    } else if (before?.floor) e.floor = "The floor can be changed but not removed";
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
    if (!room) {
      const body: RoomInput = { hostelId, roomNumber: values.roomNumber.trim(), capacity: Number(values.capacity), status: values.status };
      if (values.floor.trim()) body.floor = Number(values.floor);
      if (values.roomType.trim()) body.roomType = values.roomType.trim();
      if (values.monthlyFee.trim()) body.monthlyFee = Number(values.monthlyFee);
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, { onSuccess: done, onError });
    } else if (changes && Object.keys(changes).length) update.mutate({ id: room.id, ...changes }, { onSuccess: done, onError });
  };

  const title = room ? `Room ${room.roomNumber}` : "New room";

  if (room && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={<RoomStatusBadge status={room.status} />}>
        <DescriptionList
          items={[
            { label: "Floor", value: floorLabel(room.floor) },
            { label: "Type", value: room.roomType },
            { label: "Beds", value: `${room.occupied} of ${room.capacity} taken today` },
            { label: "Free beds", value: room.freeBeds.length ? room.freeBeds.join(", ") : "None" },
            { label: "Monthly fee", value: room.monthlyFee ? formatMoney(room.monthlyFee, currency) : null },
            { label: "Description", value: room.description, wide: true }
          ]}
        />
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={room ? `${room.occupied} of ${room.capacity} beds taken today` : undefined}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="room-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!changes && !Object.keys(changes).length}>
            {room ? "Save changes" : "Add room"}
          </Button>
        </>
      }
    >
      <form id="room-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Room number" required autoFocus={!room} maxLength={20} placeholder="e.g. A-101" {...form.text("roomNumber")} />
          <TextInput label="Floor" type="number" inputMode="numeric" hint="0 is the ground floor" {...form.text("floor")} />
          <TextInput
            label="Beds"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            hint="Beds are numbered 1 to this"
            {...form.text("capacity")}
          />
          <Select
            label="Room type"
            creatable
            value={values.roomType}
            onChange={e => form.set("roomType", e.target.value)}
            options={roomTypes.map(t => ({ value: t, label: t }))}
            placeholder="e.g. Twin sharing"
            error={errors.roomType}
            hint="Pick one in use or type a new one"
          />
          <TextInput label={`Monthly fee (${currency})`} type="number" inputMode="decimal" min={0} step="0.01" hint="Stored for reference; not invoiced" {...form.text("monthlyFee")} />
        </div>
        <Field label="Status" error={errors.status}>
          <RadioGroup aria-label="Status" options={STATUS_OPTIONS} value={values.status} onChange={v => form.set("status", v)} />
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
