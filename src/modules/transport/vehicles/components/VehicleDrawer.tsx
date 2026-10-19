import { useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, RadioGroup, Field, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_TONES, VEHICLE_STATUSES, routeLabel, type VehicleStatus } from "../../shared/utils/format";
import { createVehicle, updateVehicle, VEHICLES_PATH, type Vehicle, type VehicleDetail, type VehicleInput } from "../api/vehicles";
import { DocumentBadges } from "./DocumentBadges";

type Values = {
  registrationNumber: string;
  make: string;
  model: string;
  capacity: string;
  status: VehicleStatus;
  driverName: string;
  driverPhone: string;
  driverLicenseNumber: string;
  attendantName: string;
  attendantPhone: string;
  insuranceExpiresOn: string;
  fitnessCertificateExpiresOn: string;
  permitExpiresOn: string;
  notes: string;
};

/* Optional text and date fields: "" is sent as null to clear them */
const NULLABLE = [
  "make",
  "model",
  "driverName",
  "driverPhone",
  "driverLicenseNumber",
  "attendantName",
  "attendantPhone",
  "insuranceExpiresOn",
  "fitnessCertificateExpiresOn",
  "permitExpiresOn"
] as const;

const EMPTY: Values = {
  registrationNumber: "",
  make: "",
  model: "",
  capacity: "",
  status: "ACTIVE",
  driverName: "",
  driverPhone: "",
  driverLicenseNumber: "",
  attendantName: "",
  attendantPhone: "",
  insuranceExpiresOn: "",
  fitnessCertificateExpiresOn: "",
  permitExpiresOn: "",
  notes: ""
};

const toValues = (v: Vehicle): Values => ({
  registrationNumber: v.registrationNumber,
  make: v.make ?? "",
  model: v.model ?? "",
  capacity: String(v.capacity),
  status: v.status,
  driverName: v.driverName ?? "",
  driverPhone: v.driverPhone ?? "",
  driverLicenseNumber: v.driverLicenseNumber ?? "",
  attendantName: v.attendantName ?? "",
  attendantPhone: v.attendantPhone ?? "",
  insuranceExpiresOn: v.insuranceExpiresOn ?? "",
  fitnessCertificateExpiresOn: v.fitnessCertificateExpiresOn ?? "",
  permitExpiresOn: v.permitExpiresOn ?? "",
  notes: v.notes ?? ""
});

/* The whole body for a new vehicle (empty optional fields left out) */
function createBody(v: Values): VehicleInput {
  const body: VehicleInput = { registrationNumber: v.registrationNumber.trim(), capacity: Number(v.capacity), status: v.status };
  for (const k of NULLABLE) if (v[k].trim()) body[k] = v[k].trim();
  if (v.notes.trim()) body.notes = v.notes.trim();
  return body;
}

/* Only what changed; cleared optional fields become null (notes: "", the API refuses null there) */
function patchBody(before: Values, now: Values): Partial<VehicleInput> {
  const out: Partial<VehicleInput> = {};
  if (now.registrationNumber.trim() !== before.registrationNumber) out.registrationNumber = now.registrationNumber.trim();
  if (now.capacity.trim() !== before.capacity) out.capacity = Number(now.capacity);
  if (now.status !== before.status) out.status = now.status;
  for (const k of NULLABLE) if (now[k].trim() !== before[k]) out[k] = now[k].trim() || null;
  if (now.notes.trim() !== before.notes) out.notes = now.notes.trim();
  return out;
}

const normalise = (reg: string) => reg.replace(/[\s-]+/g, "").toUpperCase();

/* Refusals that belong to one field */
function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  if (err.status === 409 && /registration number/i.test(err.message)) return "registrationNumber";
  if (err.status === 409 && /retir/i.test(err.message)) return "status";
  if (err.status === 422 && /seats/i.test(err.message)) return "capacity";
  return null;
}

const STATUS_OPTIONS = VEHICLE_STATUSES.map(s => ({
  value: s,
  label: VEHICLE_STATUS_LABELS[s],
  description: s === "ACTIVE" ? "On the road" : s === "IN_MAINTENANCE" ? "Off the road for now; keeps its route" : "No longer used; must not serve a route"
}));

/* TR-01 drawer: add (vehicle = null), view, or edit one vehicle. Readers see it read-only. */
export function VehicleDrawer({
  open,
  vehicle,
  canEdit,
  onClose
}: {
  open: boolean;
  vehicle: Vehicle | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const detail = useApiGet<VehicleDetail>(open && vehicle ? `${VEHICLES_PATH}/${vehicle.id}` : null);
  const create = useApiMutation(createVehicle, { invalidate: ["/transport"] });
  const update = useApiMutation(updateVehicle, { invalidate: ["/transport"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(vehicle ? toValues(vehicle) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  const before = vehicle ? toValues(vehicle) : null;
  const changes = before ? patchBody(before, values) : null;
  const unchanged = !!changes && Object.keys(changes).length === 0;
  const route = detail.data?.route ?? null;

  const validate = () => {
    const e: Record<string, string> = {};
    const reg = normalise(values.registrationNumber);
    if (!reg) e.registrationNumber = "Enter the registration number";
    else if (!/^[A-Z0-9]{4,15}$/.test(reg)) e.registrationNumber = "4 to 15 letters and digits";
    const seats = Number(values.capacity);
    if (!values.capacity.trim()) e.capacity = "Enter the number of seats";
    else if (!Number.isInteger(seats) || seats < 1 || seats > 200) e.capacity = "A whole number from 1 to 200";
    if (values.status === "RETIRED" && route) e.status = `Serves ${routeLabel(route)}: give the route another vehicle first`;
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
    if (!vehicle) create.mutate(createBody(values), { onSuccess: done, onError });
    else if (changes && Object.keys(changes).length) update.mutate({ id: vehicle.id, ...changes }, { onSuccess: done, onError });
  };

  const title = vehicle ? <span className="mono">{vehicle.registrationNumber}</span> : "New vehicle";
  const subtitle = vehicle && (
    <span className="row" style={{ gap: 8, minHeight: 22 }}>
      <Badge tone={VEHICLE_STATUS_TONES[vehicle.status]} dot>
        {VEHICLE_STATUS_LABELS[vehicle.status]}
      </Badge>
      {detail.isLoading ? (
        <span className="skeleton" style={{ display: "inline-block", width: 120, height: 12 }} />
      ) : route ? (
        <span>
          Serves <Link to={`/transport/routes/${route.id}`}>{routeLabel(route)}</Link> · {route.name}
        </span>
      ) : (
        <span>Not on a route</span>
      )}
    </span>
  );

  if (vehicle && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle}>
        <div className="stack">
            <DescriptionList
              items={[
                { label: "Make", value: vehicle.make },
                { label: "Model", value: vehicle.model },
                { label: "Seats", value: vehicle.capacity }
              ]}
            />
            <div className="section-title">Crew</div>
            <DescriptionList
              items={[
                { label: "Driver", value: vehicle.driverName },
                { label: "Driver phone", value: vehicle.driverPhone },
                { label: "Driving licence", value: vehicle.driverLicenseNumber },
                { label: "Attendant", value: vehicle.attendantName },
                { label: "Attendant phone", value: vehicle.attendantPhone }
              ]}
            />
            <div className="section-title">Compliance</div>
            <DescriptionList
              items={[
                { label: "Insurance until", value: formatDate(vehicle.insuranceExpiresOn) },
                { label: "Fitness certificate until", value: formatDate(vehicle.fitnessCertificateExpiresOn) },
                { label: "Permit until", value: formatDate(vehicle.permitExpiresOn) },
                {
                  label: "Due soon",
                  value: vehicle.expiringDocuments.length ? <DocumentBadges documents={vehicle.expiringDocuments} /> : "Nothing in the next 30 days"
                }
              ]}
            />
            <DescriptionList columns={1} items={[{ label: "Notes", value: vehicle.notes }]} />
        </div>
      </Drawer>
    );

  const busy = create.isPending || update.isPending;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="vehicle-form" variant="primary" loading={busy} disabled={unchanged}>
            {vehicle ? "Save changes" : "Add vehicle"}
          </Button>
        </>
      }
    >
      <form id="vehicle-form" className="stack" onSubmit={submit} noValidate>
        <div className="section-title">Vehicle</div>
        <div className="form-grid">
          <TextInput
            label="Registration number"
            required
            autoFocus={!vehicle}
            maxLength={20}
            hint="Spaces and hyphens are ignored"
            className="mono"
            {...form.text("registrationNumber")}
          />
          <TextInput label="Seats" type="number" inputMode="numeric" min={1} max={200} required hint="Students it can carry" {...form.text("capacity")} />
          <TextInput label="Make" maxLength={100} placeholder="e.g. Tata" {...form.text("make")} />
          <TextInput label="Model" maxLength={100} placeholder="e.g. Starbus 41" {...form.text("model")} />
        </div>
        <Field label="Status" error={errors.status}>
          <RadioGroup aria-label="Status" options={STATUS_OPTIONS} value={values.status} onChange={v => form.set("status", v)} />
        </Field>

        <div className="section-title">Crew</div>
        <div className="form-grid">
          <TextInput label="Driver" maxLength={100} {...form.text("driverName")} />
          <TextInput label="Driver phone" type="tel" maxLength={20} {...form.text("driverPhone")} />
          <TextInput label="Driving licence number" maxLength={50} {...form.text("driverLicenseNumber")} fieldClassName="span-2" />
          <TextInput label="Attendant" maxLength={100} {...form.text("attendantName")} />
          <TextInput label="Attendant phone" type="tel" maxLength={20} {...form.text("attendantPhone")} />
        </div>

        <div className="section-title">Compliance dates</div>
        <div className="form-grid">
          <TextInput label="Insurance valid until" type="date" {...form.text("insuranceExpiresOn")} />
          <TextInput label="Fitness certificate valid until" type="date" {...form.text("fitnessCertificateExpiresOn")} />
          <TextInput label="Permit valid until" type="date" {...form.text("permitExpiresOn")} />
        </div>

        <Textarea label="Notes" rows={2} maxLength={1000} {...form.text("notes")} />
      </form>
    </Drawer>
  );
}
