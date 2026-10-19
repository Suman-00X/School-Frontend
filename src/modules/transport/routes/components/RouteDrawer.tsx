import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Select, TextInput, Textarea, useToast, type Option } from "@/common/ui";
import { useSchoolCurrency } from "@/modules/users/shared";
import { routeLabel, VEHICLE_STATUS_LABELS, type VehicleStatus } from "../../shared/utils/format";
import { useAllVehicles } from "../../vehicles/api/vehicles";
import { createRoute, updateRoute, useAllRoutes, type RouteDetail, type RouteInput, type TransportRoute } from "../api/routes";
import { blankStop, StopsEditor, stopsBody, validateStops, type StopRow } from "./StopsEditor";

type Values = { name: string; code: string; vehicleId: string; description: string };

const EMPTY: Values = { name: "", code: "", vehicleId: "", description: "" };

/* Vehicles a route may use: not retired, not serving another route (those are shown, disabled) */
export function useVehicleOptions(routeId: string | null) {
  const vehicles = useAllVehicles();
  const routes = useAllRoutes();
  const options = useMemo<Option[]>(() => {
    const servedBy = new Map((routes.rows ?? []).filter(r => r.vehicleId).map(r => [r.vehicleId!, r]));
    return (vehicles.rows ?? [])
      .filter(v => v.status !== "RETIRED")
      .map(v => {
        const other = servedBy.get(v.id);
        const busy = other && other.id !== routeId ? other : null;
        const parts = [`${v.capacity} seats`, [v.make, v.model].filter(Boolean).join(" ")];
        if (v.status !== "ACTIVE") parts.push(VEHICLE_STATUS_LABELS[v.status as VehicleStatus]);
        if (busy) parts.push(`serves ${routeLabel(busy)}`);
        return { value: v.id, label: v.registrationNumber, description: parts.filter(Boolean).join(" · "), disabled: !!busy };
      });
  }, [vehicles.rows, routes.rows, routeId]);
  return { options, isLoading: vehicles.isLoading || routes.isLoading };
}

/* Refusals that belong to one field */
function fieldOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  if (err.status === 409 && /named/i.test(err.message)) return "name";
  if (err.status === 409 && /code/i.test(err.message)) return "code";
  if ((err.status === 409 || err.status === 422) && /vehicle/i.test(err.message)) return "vehicleId";
  if (err.status === 409 && /stop/i.test(err.message)) return "stops";
  return null;
}

/* TR-02 drawer. New route (with its stops), or edit an existing route's name, code, vehicle and
   description. An existing route's stops are edited on its Stops tab. */
export function RouteDrawer({ open, route, onClose }: { open: boolean; route: TransportRoute | RouteDetail | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const currency = useSchoolCurrency();
  const form = useForm<Values>(EMPTY);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [stopErrors, setStopErrors] = useState<Record<string, string>>({});
  const vehicleOptions = useVehicleOptions(route?.id ?? null);
  const create = useApiMutation(createRoute, { invalidate: ["/transport"] });
  const update = useApiMutation(updateRoute, { invalidate: ["/transport"] });
  const { values } = form;

  const before: Values | null = route
    ? { name: route.name, code: route.code, vehicleId: route.vehicleId ?? "", description: route.description ?? "" }
    : null;

  useEffect(() => {
    if (!open) return;
    form.reset(before ?? EMPTY);
    setStops([blankStop()]);
    setStopErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, route?.id]);

  const changes = useMemo(() => {
    if (!before) return null;
    const out: Partial<RouteInput> = {};
    const name = values.name.trim().replace(/\s+/g, " ");
    if (name !== before.name) out.name = name;
    if (values.code.trim().toUpperCase() !== before.code) out.code = values.code.trim().toUpperCase();
    if (values.vehicleId !== before.vehicleId) out.vehicleId = values.vehicleId || null;
    if (values.description.trim() !== before.description) out.description = values.description.trim();
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, route]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Name the route";
    const code = values.code.trim();
    if (route && !code) e.code = "A route keeps a code";
    else if (code && !/^[A-Za-z0-9_-]{1,20}$/.test(code)) e.code = "1 to 20 letters, digits, - or _";
    form.setErrors(e);
    const se = route ? {} : validateStops(stops);
    setStopErrors(se);
    return Object.keys(e).length === 0 && Object.keys(se).length === 0;
  };

  const onError = (err: unknown) => {
    const field = fieldOf(err);
    if (field === "stops") {
      setStopErrors({ stops: (err as Error).message });
      form.setFormError(null);
    } else if (field) {
      form.setErrors({ [field]: (err as Error).message });
      form.setFormError(null);
    } else {
      form.setServerErrors(err);
      /* Stop errors arrive as stops.N.field */
      if (isApiError(err) && err.isValidation)
        setStopErrors(Object.fromEntries(err.details.filter(d => d.field.startsWith("stops")).map(d => [d.field, d.message])));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    if (!route) {
      const body: RouteInput = { name: values.name.trim(), stops: stopsBody(stops) };
      if (values.code.trim()) body.code = values.code.trim().toUpperCase();
      if (values.vehicleId) body.vehicleId = values.vehicleId;
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`/transport/routes/${res.data.id}`);
        },
        onError
      });
    } else if (changes && Object.keys(changes).length)
      update.mutate(
        { id: route.id, ...changes },
        {
          onSuccess: res => {
            toast.success(res.message);
            onClose();
          },
          onError
        }
      );
  };

  const busy = create.isPending || update.isPending;
  const unchanged = !!changes && Object.keys(changes).length === 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide={!route}
      title={route ? `Edit ${routeLabel(route)}` : "New route"}
      subtitle={route ? route.name : "A route, its vehicle and its stops in order"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="route-form" variant="primary" loading={busy} disabled={unchanged}>
            {route ? "Save changes" : "Create route"}
          </Button>
        </>
      }
    >
      <form id="route-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!route} maxLength={100} placeholder="e.g. Route 1 – Indiranagar" {...form.text("name")} />
          <TextInput
            label="Code"
            maxLength={20}
            className="mono"
            required={!!route}
            hint={route ? "Shown on rosters and seat lists" : "Left blank, the next code (RT-001…) is given"}
            {...form.text("code")}
          />
          <Select
            label="Vehicle"
            value={values.vehicleId}
            onChange={e => form.set("vehicleId", e.target.value)}
            options={vehicleOptions.options}
            placeholder={vehicleOptions.isLoading ? "Loading vehicles…" : "No vehicle yet"}
            error={form.errors.vehicleId}
            hint={values.vehicleId ? "Its seats are the route's capacity" : "Without a vehicle the route can't take students"}
            fieldClassName="span-2"
          />
        </div>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
        {!route && (
          <>
            <div className="section-title">Stops</div>
            <StopsEditor rows={stops} onChange={setStops} errors={stopErrors} currency={currency} />
          </>
        )}
      </form>
    </Drawer>
  );
}
