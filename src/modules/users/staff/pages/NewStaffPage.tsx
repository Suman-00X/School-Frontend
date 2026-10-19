import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { compact, useApiMutation, useForm } from "@/common/hooks";
import { Alert, Button, ButtonLink, Card, Page, PageHeader, useToast } from "@/common/ui";
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

/* PE-06 · New staff member: role first (fixed for good), then the person and employment details */
export default function NewStaffPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm({ role: "", ...emptyPerson(), designation: "", department: "", ...emptyEmployment() });
  const create = useApiMutation(createStaffMember, { invalidate: ["/users"] });

  const submit = async () => {
    const errors: Record<string, string> = validatePerson(form.values);
    if (!form.values.role) errors.role = "Choose a role";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
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
    }
  };

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: "Staff", to: "/users/staff" }, { label: "New staff member" }]}
        title="New staff member"
        subtitle="Creates the sign-in account and the staff profile. The employee code is generated when you save."
      />
      <form
        className="stack"
        style={{ maxWidth: 860 }}
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Card title="Role" subtitle="What the account can do across the school.">
          <RolePicker value={form.values.role} onChange={r => form.set("role", r)} error={form.errors.role} />
        </Card>
        <Card title="Personal details" subtitle="The account's name and contact details. Invite them to set a password after saving.">
          <PersonFields form={form} />
        </Card>
        <Card title="Employment">
          <div className="stack">
            <StaffProfileFields form={form} />
            <EmploymentFields form={form} />
          </div>
        </Card>
        <div className="form-actions">
          <ButtonLink to="/users/staff">Cancel</ButtonLink>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create staff member
          </Button>
        </div>
      </form>
    </Page>
  );
}
