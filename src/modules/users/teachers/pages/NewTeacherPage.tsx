import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Button, ButtonLink, Card, FormActions, Page, TextInput, useToast } from "@/common/ui";
import {
  EMPLOYMENT_KEYS,
  EmploymentFields,
  PERSON_KEYS,
  PersonFields,
  emptyEmployment,
  emptyPerson,
  employmentPayload,
  nestedFieldMap,
  personPayload,
  pick,
  validatePerson,
  type EmploymentValues,
  type PersonValues
} from "@/modules/users/shared";
import { createTeacher } from "../api/teachers";
import { experienceError } from "../utils/teacher";

const FIELD_MAP = { ...nestedFieldMap("user", PERSON_KEYS), ...nestedFieldMap("profile", [...EMPLOYMENT_KEYS, "experienceYears"]) };

/* PE-05 · New teacher: account and profile in one call; the employee code is generated */
export default function NewTeacherPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm({ ...emptyPerson(), ...emptyEmployment(), experienceYears: "" });
  const create = useApiMutation(createTeacher, { invalidate: ["/users"] });

  const submit = async () => {
    form.setFormError(null);
    const errors: Record<string, string> = validatePerson(form.values);
    const exp = experienceError(form.values.experienceYears);
    if (exp) errors.experienceYears = exp;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      return;
    }
    const v = form.values;
    try {
      const res = await create.mutateAsync({
        user: personPayload(pick(v, PERSON_KEYS) as PersonValues),
        profile: {
          ...employmentPayload(pick(v, EMPLOYMENT_KEYS) as EmploymentValues),
          ...(v.experienceYears.trim() && { experienceYears: Number(v.experienceYears) })
        }
      });
      toast.success(`${res.message}. Employee code ${res.data.employeeCode}`);
      navigate(`/users/teachers/${res.data.id}`, { replace: true });
    } catch (e) {
      form.setServerErrors(e, FIELD_MAP);
      if (isApiError(e) && e.status === 409) form.setErrors({ email: e.message });
    }
  };

  return (
    <Page>
      <DrillHeader back="/users/teachers" backLabel="Back to teachers" title="New teacher" />
      <form
        className="stack"
        style={{ maxWidth: 860 }}
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <Card
          title="Personal details"
          subtitle="Creates the sign-in account and the teacher profile. Invite them to set a password after saving."
        >
          <PersonFields form={form} />
        </Card>
        <Card title="Employment" subtitle="The employee code is generated when you save.">
          <div className="stack">
            <EmploymentFields form={form} />
            <div className="form-grid">
              <TextInput label="Experience (years)" type="number" min={0} max={60} step={1} {...form.text("experienceYears")} />
            </div>
          </div>
        </Card>
        <FormActions error={form.formError}>
          <ButtonLink to="/users/teachers">Cancel</ButtonLink>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create teacher
          </Button>
        </FormActions>
      </form>
    </Page>
  );
}
