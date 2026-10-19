import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, Mail, Pencil, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  Drawer,
  ErrorState,
  Page,
  RoleBadge,
  SkeletonBlock,
  useTabParam,
  useToast,
  type TabItem
} from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import {
  DrillName,
  EMPLOYMENT_KEYS,
  EMPLOYMENT_TEXT_KEYS,
  EffectiveAccess,
  EmploymentFields,
  RecordHeader,
  employmentFrom,
  patchFrom
} from "@/modules/users/shared";
import { STAFF_PROFILE_KEYS, STAFF_ROLE_INFO, updateStaffMember, useStaffMember, type StaffMember, type StaffRole } from "../api/staff";
import { StaffDocuments } from "../components/StaffDocuments";
import { StaffProfileFields } from "../components/StaffProfileFields";

/* PE-06 · Staff member: drill-in header (name, Profile / Documents / Access), a header card
   with the key facts and actions, then the open tab */
export default function StaffDetailPage() {
  const { staffId = "" } = useParams();
  const { can } = useAuth();
  const staff = useStaffMember(staffId);
  const [editing, setEditing] = useState(false);

  const tabs: TabItem[] = [
    { id: "profile", label: "Profile" },
    { id: "documents", label: "Documents", hidden: !can("files.documents.read") },
    { id: "access", label: "Access", hidden: !can("administration.access.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const s = staff.data;
  const name = s ? fullName(s.user) : "";
  const header = <DrillHeader back="/users/staff" backLabel="Back to staff" title={<DrillName name={name} />} tabs={tabs} value={tab} onChange={setTab} />;

  if (staff.error || (!staff.isLoading && !s))
    return (
      <Page>
        {header}
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      </Page>
    );

  const roleInfo = s ? STAFF_ROLE_INFO[s.user.role as StaffRole] : undefined;

  return (
    <Page>
      {header}
      <RecordHeader
        loading={!s}
        name={name}
        facts={
          s && (
            <>
              <Badge tone="primary">
                <span className="mono">{s.employeeCode}</span>
              </Badge>
              <RoleBadge role={s.user.role} />
              {s.designation && <span className="small muted">{s.designation}</span>}
            </>
          )
        }
        contact={
          s && (
            <>
              <span className="row" style={{ gap: 4 }}>
                <Mail size={14} /> {s.user.email}
              </span>
              {s.user.phone && (
                <span className="row" style={{ gap: 4 }}>
                  <Phone size={14} /> {s.user.phone}
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            <InviteButton userIds={s ? [s.user.id] : []} names={s ? { [s.user.id]: name } : {}} />
            {can("users.accounts.read") && (
              <ButtonLink icon={<ExternalLink />} to={s ? `/users/${s.user.id}` : "#"}>
                Account
              </ButtonLink>
            )}
            {can("users.staff.update") && (
              <Button icon={<Pencil />} disabled={!s} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            )}
          </>
        }
      />
      {!s ? (
        <SkeletonBlock lines={8} />
      ) : (
        <>
          {tab === "profile" && (
            <Card title="Profile" subtitle={roleInfo ? `${roleInfo.label}: ${roleInfo.description}` : undefined}>
              <DescriptionList
                columns={3}
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
          )}
          {tab === "documents" && <StaffDocuments staffId={s.id} personName={name} />}
          {tab === "access" && (
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
        </>
      )}
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
      footerStatus={form.formError}
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
        <StaffProfileFields form={form} />
        <EmploymentFields form={form} />
      </form>
    </Drawer>
  );
}
