import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, Pencil, ShieldCheck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import {
  Alert,
  Avatar,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  Drawer,
  ErrorState,
  Page,
  PageHeader,
  PageLoader,
  RoleBadge,
  useToast
} from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { EMPLOYMENT_KEYS, EMPLOYMENT_TEXT_KEYS, EffectiveAccess, EmploymentFields, employmentFrom, patchFrom } from "@/modules/users/shared";
import { STAFF_PROFILE_KEYS, STAFF_ROLE_INFO, updateStaffMember, useStaffMember, type StaffMember, type StaffRole } from "../api/staff";
import { StaffDocuments } from "../components/StaffDocuments";
import { StaffProfileFields } from "../components/StaffProfileFields";

/* PE-06 · Staff member: profile, effective access, documents */
export default function StaffDetailPage() {
  const { staffId = "" } = useParams();
  const { can } = useAuth();
  const staff = useStaffMember(staffId);
  const [editing, setEditing] = useState(false);

  if (staff.isLoading) return <PageLoader />;
  if (staff.error || !staff.data)
    return (
      <Page>
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      </Page>
    );

  const s = staff.data;
  const name = fullName(s.user);
  const roleInfo = STAFF_ROLE_INFO[s.user.role as StaffRole];

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: "Staff", to: "/users/staff" }, { label: name }]}
        title={
          <span className="row" style={{ gap: 12 }}>
            <Avatar name={name} size="lg" />
            <span>
              {name} <RoleBadge role={s.user.role} />
              <span className="small muted" style={{ display: "block", fontWeight: 400 }}>
                <span className="mono">{s.employeeCode}</span>
                {s.designation ? ` · ${s.designation}` : ""}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <InviteButton userIds={[s.user.id]} names={{ [s.user.id]: name }} />
            {can("users.accounts.read") && (
              <ButtonLink icon={<ExternalLink />} to={`/users/${s.user.id}`}>
                Account
              </ButtonLink>
            )}
            {can("users.staff.update") && (
              <Button icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            )}
          </>
        }
      />
      <div className="grid-2">
        <Card title="Profile" subtitle={roleInfo ? `${roleInfo.label}: ${roleInfo.description}` : undefined}>
          <DescriptionList
            items={[
              { label: "Employee code", value: <span className="mono">{s.employeeCode}</span> },
              { label: "Role", value: <RoleBadge role={s.user.role} /> },
              { label: "Email", value: s.user.email },
              { label: "Phone", value: s.user.phone },
              { label: "Designation", value: s.designation },
              { label: "Department", value: s.department },
              { label: "Qualification", value: s.qualification },
              { label: "Joined", value: formatDate(s.joiningDate) },
              { label: "Employment type", value: enumLabel(s.employmentType) },
              { label: "Blood group", value: s.bloodGroup },
              { label: "Notes", value: s.description, wide: true }
            ]}
          />
          <div className="small muted" style={{ marginTop: 12 }}>
            The role can't be changed. Name, email and phone are on the account
            {can("users.accounts.update") && (
              <>
                {": "}
                <ButtonLink variant="link" to={`/users/${s.user.id}`}>
                  edit them there
                </ButtonLink>
              </>
            )}
            .
          </div>
        </Card>
        {can("files.documents.read") && <StaffDocuments staffId={s.id} personName={name} />}
      </div>
      {can("administration.access.read") && (
        <EffectiveAccess
          userId={s.user.id}
          title="Access"
          actions={
            can("administration.access.manage") && (
              <ButtonLink size="sm" icon={<ShieldCheck />} to={`/administration/access/assignments?userId=${s.user.id}`}>
                Manage access
              </ButtonLink>
            )
          }
        />
      )}
      <EditStaffDrawer staff={s} open={editing} onClose={() => setEditing(false)} />
    </Page>
  );
}

const PROFILE_KEYS = [...STAFF_PROFILE_KEYS, ...EMPLOYMENT_KEYS];

/* Profile fields only; the role is fixed and the person fields live on the account (AD-06) */
function EditStaffDrawer({ staff, open, onClose }: { staff: StaffMember; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const original = { designation: staff.designation ?? "", department: staff.department ?? "", ...employmentFrom(staff) };
  const form = useForm(original);
  const save = useApiMutation((body: Record<string, string>) => updateStaffMember(staff.id, body), { invalidate: ["/users"] });

  const close = () => {
    form.reset(original);
    onClose();
  };

  const submit = async () => {
    const { body, errors } = patchFrom(original, form.values, [...STAFF_PROFILE_KEYS, ...EMPLOYMENT_TEXT_KEYS]);
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    if (!Object.keys(body).length) return close();
    try {
      const res = await save.mutateAsync(body);
      toast.success(res.message);
      onClose();
    } catch (e) {
      form.setServerErrors(e, Object.fromEntries(PROFILE_KEYS.map(k => [k, k])));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Edit profile"
      subtitle={`${fullName(staff.user)} · ${staff.employeeCode}`}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void submit()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <StaffProfileFields form={form} />
        <EmploymentFields form={form} />
      </form>
    </Drawer>
  );
}
