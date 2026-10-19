import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/common/auth";
import { compact, useForm } from "@/common/hooks";
import { Alert, Button, Drawer, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import {
  useAssignments,
  useCreateAssignment,
  useManagedModules,
  useOperatorRole,
  useOperatorRoles,
  type AssignmentKind,
  type NewAssignment
} from "../api/access";
import { usePeopleFrom, type Person } from "../api/people";
import { PersonPicker, usePersonById } from "./PersonPicker";

export type AssignmentPrefill = { module?: string; operatorRoleId?: string; userId?: string };

type Values = { module: string; operatorRoleId: string; validFrom: string; validTo: string; note: string };

/* "Add operator" (a role to a person) and "Make owner" (ADMIN): one form, two kinds */
export function AssignmentFormDrawer({
  kind,
  open,
  onClose,
  prefill = {}
}: {
  kind: AssignmentKind;
  open: boolean;
  onClose: () => void;
  prefill?: AssignmentPrefill;
}) {
  return open ? <FormDrawer kind={kind} onClose={onClose} prefill={prefill} /> : null;
}

function FormDrawer({ kind, onClose, prefill }: { kind: AssignmentKind; onClose: () => void; prefill: AssignmentPrefill }) {
  const toast = useToast();
  const { can } = useAuth();
  const create = useCreateAssignment();
  const { modules } = useManagedModules();
  const prefRole = useOperatorRole(kind === "OPERATOR" && prefill.operatorRoleId && !prefill.module ? prefill.operatorRoleId : null);

  const form = useForm<Values>({
    module: prefill.module ?? "",
    operatorRoleId: kind === "OPERATOR" ? (prefill.operatorRoleId ?? "") : "",
    validFrom: "",
    validTo: "",
    note: ""
  });
  const { values } = form;

  /* The role link carries no module: take it from the role */
  useEffect(() => {
    if (prefRole.data && !values.module) form.set("module", prefRole.data.module);
  }, [prefRole.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!values.module && modules.length === 1) form.set("module", modules[0].value);
  }, [modules]); // eslint-disable-line react-hooks/exhaustive-deps

  const roles = useOperatorRoles({ module: values.module, limit: 100 }, kind === "OPERATOR" && !!values.module);
  /* Owners can't list employees: offer the people already working in the module */
  const inModule = useAssignments({ module: values.module, limit: 100 }, !!values.module && !can("users.staff.read"));
  const known = usePeopleFrom(inModule.rows);

  const prefPerson = usePersonById(prefill.userId, known);
  const [person, setPerson] = useState<Person | null>(null);
  const [touched, setTouched] = useState(false);
  const chosen = touched ? person : (person ?? prefPerson);

  const roleOptions = useMemo(() => (roles.rows ?? []).map(r => ({ value: r.id, label: r.name })), [roles.rows]);
  const moduleLabel = modules.find(m => m.value === values.module)?.label;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.module) errors.module = "is required";
    if (kind === "OPERATOR" && !values.operatorRoleId) errors.operatorRoleId = "is required";
    if (!chosen) errors.userId = "pick a person";
    if (values.validFrom && values.validTo && values.validTo < values.validFrom) errors.validTo = "cannot be before the start date";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError(null);
      return;
    }
    const dates = compact({ validFrom: values.validFrom, validTo: values.validTo, note: values.note.trim() });
    const body: NewAssignment =
      kind === "OWNER"
        ? { kind: "OWNER", module: values.module, userId: chosen!.id, ...dates }
        : { operatorRoleId: values.operatorRoleId, userId: chosen!.id, ...dates };
    form.setFormError(null);
    create.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => form.setServerErrors(err)
    });
  };

  const title = kind === "OWNER" ? "Make owner" : "Add operator";

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle={
        kind === "OWNER"
          ? "An owner runs the module like its built-in manager: its setup, operators and activity."
          : "Give someone an operator role for a period."
      }
      footer={
        <>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="assignment-form" loading={create.isPending}>
            {title}
          </Button>
        </>
      }
    >
      <form id="assignment-form" className="stack" onSubmit={submit} noValidate>
        <Select
          label="Module"
          required
          placeholder="Choose a module"
          options={modules}
          value={values.module}
          error={form.errors.module}
          onChange={e => {
            form.set("module", e.target.value);
            form.set("operatorRoleId", "");
          }}
        />
        {kind === "OPERATOR" && (
          <Select
            label="Operator role"
            required
            placeholder={!values.module ? "Choose a module first" : roles.isLoading ? "Loading roles…" : roleOptions.length ? "Choose a role" : "This module has no roles yet"}
            options={roleOptions}
            disabled={!values.module || !roleOptions.length}
            {...form.text("operatorRoleId")}
          />
        )}
        <PersonPicker
          label="Person"
          required
          value={chosen}
          onChange={p => {
            setTouched(true);
            setPerson(p);
            form.setErrors({ ...form.errors, userId: "" });
          }}
          known={known}
          error={form.errors.userId || undefined}
          hint={moduleLabel ? `An active employee who doesn't already run the ${moduleLabel} module.` : undefined}
        />
        <div className="form-grid">
          <TextInput label="From" type="date" hint="Blank: from today" {...form.text("validFrom")} />
          <TextInput label="Until" type="date" hint="Inclusive. Blank: no end date" min={values.validFrom > todayIso() ? values.validFrom : todayIso()} {...form.text("validTo")} />
        </div>
        <Textarea label="Note" rows={2} maxLength={500} placeholder="e.g. Covering the front desk this term" {...form.text("note")} />
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      </form>
    </Drawer>
  );
}
