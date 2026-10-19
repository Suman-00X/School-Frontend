import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, ButtonLink, FormActions, FormTabs, Page, PageHeader, TextInput, errorCount, useToast } from "@/common/ui";
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

const PROFILE_KEYS = [...EMPLOYMENT_KEYS, "experienceYears"];
const FIELD_MAP = { ...nestedFieldMap("user", PERSON_KEYS), ...nestedFieldMap("profile", PROFILE_KEYS) };

/* PE-05 · New teacher, in the User Management list area: account and profile in one call, in two
   tabs (personal, employment); the employee code is generated */
export default function NewTeacherPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm({ ...emptyPerson(), ...emptyEmployment(), experienceYears: "" });
  const create = useApiMutation(createTeacher, { invalidate: ["/users"] });
  /* Failed saves: FormTabs opens the first tab with errors */
  const [attempt, setAttempt] = useState(0);

  const submit = async () => {
    form.setFormError(null);
    const errors: Record<string, string> = validatePerson(form.values);
    const exp = experienceError(form.values.experienceYears);
    if (exp) errors.experienceYears = exp;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      setAttempt(a => a + 1);
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
      setAttempt(a => a + 1);
    }
  };

  return (
    <Page>
      <PageHeader
        title="New teacher"
        subtitle="Creates the sign-in account and the teacher profile. Invite them to set a password after saving."
        breadcrumbs={[{ label: "Teachers", to: "/users/teachers" }, { label: "New teacher" }]}
      />
      <form
        className="stack"
        style={{ maxWidth: 860 }}
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormTabs
          attempt={attempt}
          tabs={[
            { id: "personal", label: "Personal details", errors: errorCount(form.errors, PERSON_KEYS), content: <PersonFields form={form} /> },
            {
              id: "employment",
              label: "Employment",
              hint: "The employee code is generated when you save.",
              errors: errorCount(form.errors, PROFILE_KEYS),
              content: (
                <div className="stack">
                  <EmploymentFields form={form} teacher />
                  <div className="form-grid">
                    <TextInput label="Experience (years)" type="number" min={0} max={60} step={1} {...form.text("experienceYears")} />
                  </div>
                </div>
              )
            }
          ]}
        />
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
