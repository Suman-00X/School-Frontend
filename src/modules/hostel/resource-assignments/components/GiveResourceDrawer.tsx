import { useEffect, useMemo, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Select, TextInput, Textarea, useToast, type Option } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { resourceTypeLabel } from "../../shared/utils/format";
import { ALLOCATIONS_PATH, type Allocation } from "../../allocations/api/allocations";
import { RESOURCES_PATH, type Resource } from "../../resources/api/resources";
import { giveResource, type GiveInput } from "../api/resourceAssignments";

type Values = { studentId: string; allocationId: string; resourceId: string; fromDate: string; toDate: string; notes: string };

const NO_BED = "none";

const stay = (a: Allocation) => `${formatDate(a.fromDate)} – ${a.toDate ? formatDate(a.toDate) : "no end"}`;

function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  const m = err.message;
  if (/allocationId|another room|another hostel|belongs to a room|bed/i.test(m)) return "allocationId";
  if (/already holds|already on|not actively enrolled|studentId/i.test(m)) return "studentId";
  if (/taken|full|out of service|resourceId/i.test(m)) return "resourceId";
  if (/toDate/.test(m)) return "toDate";
  if (/fromDate|outside|within/i.test(m)) return "fromDate";
  return null;
}

/* HO-04 "Give resource": student, then their bed (room items need it), then a resource with
   today's free places. Dates default to the bed's dates when tied, else from today with no end. */
export function GiveResourceDrawer({ open, prefill, onClose }: { open: boolean; prefill?: { resourceId?: string; studentId?: string }; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>({ studentId: "", allocationId: "", resourceId: "", fromDate: "", toDate: "", notes: "" });
  const give = useApiMutation(giveResource, { invalidate: ["/hostel"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset({ studentId: prefill?.studentId ?? "", allocationId: "", resourceId: prefill?.resourceId ?? "", fromDate: "", toDate: "", notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* The student's current and upcoming beds */
  const beds = useApiList<Allocation>(ALLOCATIONS_PATH, { studentId: values.studentId, limit: 20 }, { enabled: open && !!values.studentId });
  const openBeds = useMemo(() => (beds.isPlaceholderData ? [] : (beds.rows ?? [])).filter(a => a.phase === "CURRENT" || a.phase === "UPCOMING"), [beds.rows, beds.isPlaceholderData]);

  /* Tie to the first open bed once the beds load */
  useEffect(() => {
    /* (not while the previous student's beds are still shown) */
    if (!values.studentId || !beds.rows || beds.isPlaceholderData) return;
    if (!values.allocationId) form.set("allocationId", openBeds[0]?.id ?? NO_BED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beds.rows, beds.isPlaceholderData, values.studentId]);

  const bed = openBeds.find(a => a.id === values.allocationId) ?? null;
  const resources = useApiList<Resource>(RESOURCES_PATH, { status: "AVAILABLE", hostelId: bed?.hostelId, limit: 100 }, { enabled: open });

  const resourceOptions = useMemo<Option[]>(
    () =>
      (resources.rows ?? [])
        /* With a bed: its hostel's hostel-wide resources and its room's items; without: hostel-wide only */
        .filter(r => (bed ? r.hostelId === bed.hostelId && (!r.roomId || r.roomId === bed.roomId) : !r.roomId))
        .map(r => ({
          value: r.id,
          label: r.name,
          description: [
            resourceTypeLabel(r),
            r.room ? `Room ${r.room.roomNumber}` : bed ? "Hostel-wide" : `${r.hostel.code}, hostel-wide`,
            r.available ? `${r.available} of ${r.capacity} free today` : "Full today"
          ].join(" · ")
        })),
    [resources.rows, bed]
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const errs: Record<string, string> = {};
    if (!values.studentId) errs.studentId = "Pick the student";
    if (!values.resourceId) errs.resourceId = "Pick a resource";
    if (values.toDate && values.fromDate && values.toDate < values.fromDate) errs.toDate = "On or after the first day";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: GiveInput = { resourceId: values.resourceId, studentId: values.studentId };
    if (bed) body.allocationId = bed.id;
    if (values.fromDate) body.fromDate = values.fromDate;
    if (values.toDate) body.toDate = values.toDate;
    if (values.notes.trim()) body.notes = values.notes.trim();
    give.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => {
        const field = fieldOf(err);
        if (field) {
          form.setErrors({ [field]: (err as Error).message });
          form.setFormError(null);
        } else form.setServerErrors(err);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Give a resource"
      subtitle="A locker, cupboard or study table in a room goes with the resident's bed."
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="give-resource-form" variant="primary" loading={give.isPending}>
            Give resource
          </Button>
        </>
      }
    >
      <form id="give-resource-form" className="stack" onSubmit={submit} noValidate>
        <StudentSelect
          required
          value={values.studentId}
          onChange={e => {
            form.set("studentId", e.target.value);
            form.set("allocationId", "");
          }}
          error={errors.studentId}
        />
        <Select
          label="Bed"
          value={values.allocationId}
          onChange={e => {
            form.set("allocationId", e.target.value);
            form.set("resourceId", "");
          }}
          required
          disabled={!values.studentId || beds.isLoading}
          options={[
            ...openBeds.map(a => ({ value: a.id, label: `Bed ${a.bedNumber}, room ${a.room.roomNumber}, ${a.hostel.name}`, description: stay(a) })),
            { value: NO_BED, label: "Not tied to a bed", description: "Hostel-wide resources only, from today by default" }
          ]}
          placeholder={!values.studentId ? "Pick the student first" : beds.isLoading ? "Loading beds…" : "Pick a bed"}
          error={errors.allocationId}
          hint={bed ? "It ends with the bed, and its dates default to the bed's" : "Room items need the resident's bed"}
        />
        <Select
          label="Resource"
          required
          searchable
          value={values.resourceId}
          onChange={e => form.set("resourceId", e.target.value)}
          options={resourceOptions}
          placeholder={resources.isLoading ? "Loading resources…" : "Pick a resource"}
          error={errors.resourceId}
          hint="Available resources, with today's free places"
        />
        <div className="form-grid">
          <TextInput label="From" type="date" hint={bed ? "Blank: the bed's first night (or today)" : "Blank: today"} {...form.text("fromDate")} />
          <TextInput label="To" type="date" min={values.fromDate || undefined} hint={bed ? "Blank: the bed's last night" : "Blank: no end date"} {...form.text("toDate")} />
        </div>
        <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
      </form>
    </Drawer>
  );
}
