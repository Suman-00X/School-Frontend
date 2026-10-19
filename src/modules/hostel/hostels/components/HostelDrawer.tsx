import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, RadioGroup, TextInput, Textarea, useToast } from "@/common/ui";
import { PersonPicker, type Person } from "@/modules/administration";
import { GENDER_LABELS, RESIDENT_GENDERS, type ResidentGender } from "../../shared/utils/format";
import { createHostel, updateHostel, useAllHostels, wardenName, type Hostel, type HostelInput } from "../api/hostels";

type Values = { name: string; code: string; residentGender: ResidentGender | ""; address: string; contactPhone: string; description: string };

const GENDER_OPTIONS = RESIDENT_GENDERS.map(g => ({
  value: g,
  label: GENDER_LABELS[g],
  description: g === "BOYS" ? "Male students only" : g === "GIRLS" ? "Female students only" : "Any student"
}));

const toPerson = (w: NonNullable<Hostel["warden"]>): Person => ({ id: w.id, name: wardenName(w), email: w.email, role: w.role });

/* Refusals that belong to one field */
function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  if (err.status === 409 && /named/i.test(err.message)) return "name";
  if (err.status === 409 && /code/i.test(err.message)) return "code";
  if (err.status === 422 && /warden/i.test(err.message)) return "wardenUserId";
  if (err.status === 422 && /residents|hostel's residents/i.test(err.message)) return "residentGender";
  return null;
}

/* HO-01 hostel form: add (hostel = null) or edit. The warden picker offers staff and teachers to
   those who can list them; module owners pick from the wardens already on record or themselves. */
export function HostelDrawer({ open, hostel, onClose }: { open: boolean; hostel: Hostel | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { me } = useAuth();
  const all = useAllHostels(open);
  const form = useForm<Values>({ name: "", code: "", residentGender: "", address: "", contactPhone: "", description: "" });
  const [warden, setWarden] = useState<Person | null>(null);
  const create = useApiMutation(createHostel, { invalidate: ["/hostel"] });
  const update = useApiMutation(updateHostel, { invalidate: ["/hostel"] });
  const { values, errors } = form;

  /* People the picker can offer without the staff list: wardens on record and the signed-in person */
  const known = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const h of all.rows ?? []) if (h.warden) byId.set(h.warden.id, toPerson(h.warden));
    if (me?.account) byId.set(me.account.id, { id: me.account.id, name: `${me.account.firstName} ${me.account.lastName}`.trim(), email: me.account.email, role: me.account.role });
    return [...byId.values()];
  }, [all.rows, me]);

  const before: Values | null = hostel
    ? {
        name: hostel.name,
        code: hostel.code,
        residentGender: hostel.residentGender,
        address: hostel.address ?? "",
        contactPhone: hostel.contactPhone ?? "",
        description: hostel.description ?? ""
      }
    : null;

  useEffect(() => {
    if (!open) return;
    form.reset(before ?? { name: "", code: "", residentGender: "", address: "", contactPhone: "", description: "" });
    setWarden(hostel?.warden ? toPerson(hostel.warden) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hostel?.id]);

  const changes = (() => {
    if (!before || !hostel) return null;
    const out: Partial<HostelInput> = {};
    const name = values.name.trim().replace(/\s+/g, " ");
    if (name !== before.name) out.name = name;
    if (values.code.trim().toUpperCase() !== before.code) out.code = values.code.trim().toUpperCase();
    if (values.residentGender && values.residentGender !== before.residentGender) out.residentGender = values.residentGender;
    if ((warden?.id ?? null) !== hostel.wardenUserId) out.wardenUserId = warden?.id ?? null;
    if (values.address.trim() !== before.address) out.address = values.address.trim();
    if (values.contactPhone.trim() !== before.contactPhone) out.contactPhone = values.contactPhone.trim();
    if (values.description.trim() !== before.description) out.description = values.description.trim();
    return out;
  })();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Name the hostel";
    const code = values.code.trim();
    if (hostel && !code) e.code = "A hostel keeps a code";
    else if (code && !/^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/.test(code)) e.code = "2 to 20 letters, digits, - or _";
    if (!values.residentGender) e.residentGender = "Pick who lives here";
    const phone = values.contactPhone.trim();
    if (phone && !/^[+0-9 ()-]{5,20}$/.test(phone)) e.contactPhone = "A phone number such as +91 98860 00068";
    else if (!phone && before?.contactPhone) e.contactPhone = "The phone can be changed but not removed";
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
    if (!hostel) {
      const body: HostelInput = { name: values.name.trim(), residentGender: values.residentGender as ResidentGender };
      if (values.code.trim()) body.code = values.code.trim().toUpperCase();
      if (warden) body.wardenUserId = warden.id;
      if (values.address.trim()) body.address = values.address.trim();
      if (values.contactPhone.trim()) body.contactPhone = values.contactPhone.trim();
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`/hostel/hostels/${res.data.id}`);
        },
        onError
      });
    } else if (changes && Object.keys(changes).length)
      update.mutate(
        { id: hostel.id, ...changes },
        {
          onSuccess: res => {
            toast.success(res.message);
            onClose();
          },
          onError
        }
      );
  };

  const unchanged = !!changes && Object.keys(changes).length === 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={hostel ? `Edit ${hostel.name}` : "New hostel"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hostel-form" variant="primary" loading={create.isPending || update.isPending} disabled={unchanged}>
            {hostel ? "Save changes" : "Add hostel"}
          </Button>
        </>
      }
    >
      <form id="hostel-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!hostel} maxLength={100} placeholder="e.g. Aravali House" {...form.text("name")} />
          <TextInput
            label="Code"
            maxLength={20}
            className="mono"
            required={!!hostel}
            hint={hostel ? "Short name on lists" : "Left blank, the next code (HST-001…) is given"}
            {...form.text("code")}
          />
        </div>
        <Field label="Residents" required error={errors.residentGender} hint="Checked against each student's gender when a bed is allocated">
          <RadioGroup aria-label="Residents" options={GENDER_OPTIONS} value={values.residentGender} onChange={v => form.set("residentGender", v)} />
        </Field>
        <PersonPicker
          label="Warden"
          value={warden}
          onChange={p => {
            setWarden(p);
            form.setErrors(e => {
              const next = { ...e };
              delete next.wardenUserId;
              return next;
            });
          }}
          known={known}
          error={errors.wardenUserId}
          hint="The person responsible. Being warden gives no access by itself."
        />
        <TextInput label="Contact phone" type="tel" maxLength={20} {...form.text("contactPhone")} />
        <Textarea label="Address" rows={2} maxLength={500} {...form.text("address")} />
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
