import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { compact, useApiMutation, useForm } from "@/common/hooks";
import { Button, ButtonLink, FormActions, FormTabs, Page, PageHeader, errorCount, useToast } from "@/common/ui";
import {
  EMPLOYMENT_KEYS,
  EmploymentFields,
  PERSON_KEYS,
  PersonFields,
  emptyEmployment,
  emptyPerson,
  nestedFieldMap,
  personPayload,
  pick,
  validatePerson,
  type PersonValues
} from "@/modules/users/shared";
import { STAFF_PROFILE_KEYS, createStaffMember } from "../api/staff";
import { RolePicker } from "../components/RolePicker";
import { StaffProfileFields } from "../components/StaffProfileFields";

const PROFILE_KEYS = [...STAFF_PROFILE_KEYS, ...EMPLOYMENT_KEYS];
const FIELD_MAP = { ...nestedFieldMap("user", PERSON_KEYS), ...nestedFieldMap("profile", PROFILE_KEYS) };

/* PE-06 · New staff member, in the User Management list area, in three tabs: role (fixed for good),
   personal details, employment */
export default function NewStaffPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm({ role: "", ...emptyPerson(), designation: "", department: "", ...emptyEmployment() });
  const create = useApiMutation(createStaffMember, { invalidate: ["/users"] });
  /* Failed saves: FormTabs opens the first tab with errors */
  const [attempt, setAttempt] = useState(0);

  const submit = async () => {
    form.setFormError(null);
    const errors: Record<string, string> = validatePerson(form.values);
    if (!form.values.role) errors.role = "Choose a role";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      setAttempt(a => a + 1);
      return;
    }
    const v = form.values;
    try {
      const res = await create.mutateAsync({
        role: v.role,
        user: personPayload(pick(v, PERSON_KEYS) as PersonValues),
        profile: compact(pick(v, PROFILE_KEYS))
      });
      toast.success(`${res.message}. Employee code ${res.data.employeeCode}`);
      navigate(`/users/staff/${res.data.id}`, { replace: true });
    } catch (e) {
      form.setServerErrors(e, FIELD_MAP);
      if (isApiError(e) && e.status === 409) form.setErrors({ email: e.message });
      setAttempt(a => a + 1);
    }
  };

  return (
    <Page>
      <PageHeader
        title="New staff member"
        subtitle="Creates the sign-in account and the staff profile. Invite them to set a password after saving."
        breadcrumbs={[{ label: "Staff", to: "/users/staff" }, { label: "New staff member" }]}
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
            {
              id: "role",
              label: "Role",
              hint: "What the account can do across the school.",
              errors: errorCount(form.errors, ["role"]),
              content: <RolePicker value={form.values.role} onChange={r => form.set("role", r)} error={form.errors.role} />
            },
            { id: "personal", label: "Personal details", errors: errorCount(form.errors, PERSON_KEYS), content: <PersonFields form={form} /> },
            {
              id: "employment",
              label: "Employment",
              hint: "The employee code is generated when you save.",
              errors: errorCount(form.errors, PROFILE_KEYS),
              content: (
                <div className="stack">
                  <StaffProfileFields form={form} />
                  <EmploymentFields form={form} />
                </div>
              )
            }
          ]}
        />
        <FormActions error={form.formError}>
          <ButtonLink to="/users/staff">Cancel</ButtonLink>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create staff member
          </Button>
        </FormActions>
      </form>
    </Page>
  );
}
