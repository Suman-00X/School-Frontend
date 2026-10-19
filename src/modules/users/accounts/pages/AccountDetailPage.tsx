import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Mail, Pencil, Phone, ShieldPlus, UserX } from "lucide-react";
import { EMPLOYEE_ROLES, isApiError, type Account } from "@/common/api";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { useApiMutation, useForm } from "@/common/hooks";
import {
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  Drawer,
  ErrorState,
  Page,
  RoleBadge,
  SkeletonBlock,
  StatusBadge,
  useConfirm,
  useTabParam,
  useToast
} from "@/common/ui";
import { enumLabel, formatDate, formatDateTime, fullName } from "@/common/utils/format";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { InviteButton } from "@/modules/auth";
import {
  DrillName,
  EffectiveAccess,
  PERSON_TEXT_KEYS,
  RecordHeader,
  PersonFields,
  patchFrom,
  personFromAccount,
  validatePerson
} from "@/modules/users/shared";
import { deactivateAccount, updateAccount, useAccount, useRoleProfile } from "../api/accounts";

/* AD-06 · One user account: Account, Access and Activity tabs in the drill-in header */
export default function AccountDetailPage() {
  const { userId = "" } = useParams();
  const { can, session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const account = useAccount(userId);
  const [editing, setEditing] = useState(false);

  const a = account.data;
  /* Operator roles go to employees only; students and parents hold just their built-in role */
  const holdsAccess = !a || EMPLOYEE_ROLES.includes(a.role);
  const tabs = [
    { id: "account", label: "Account" },
    { id: "access", label: "Access", hidden: !can("administration.access.read") || !holdsAccess },
    { id: "activity", label: "Activity", hidden: !can("administration.auditLogs.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const qc = useQueryClient();
  /* Invalidated by hand after leaving: refetching this page's account would only 404 */
  const deactivate = useApiMutation(() => deactivateAccount(userId));

  const name = a ? fullName(a) : "";
  const isSelf = session?.user.id === userId;
  /* The drill-in header is there from the first frame; only its title waits for the record */
  const header = <DrillHeader back="/users" backLabel="Back to accounts" title={<DrillName name={name} />} tabs={tabs} value={tab} onChange={setTab} />;

  if (account.error || (!account.isLoading && !a))
    return (
      <Page>
        {header}
        <ErrorState error={account.error} onRetry={() => void account.refetch()} />
      </Page>
    );

  const onDeactivate = async () => {
    const ok = await confirm({
      title: `Deactivate ${name}?`,
      message: "They are signed out at once and can no longer sign in.",
      confirmLabel: "Deactivate"
    });
    if (!ok) return;
    try {
      const res = await deactivate.mutateAsync(undefined);
      toast.success(res.message || `${name} deactivated`);
      navigate("/users");
      qc.removeQueries({ queryKey: [`/users/${userId}`] });
      void qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/users") });
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Page>
      {header}
      <RecordHeader
        loading={!a}
        name={name}
        facts={
          a && (
            <>
              <RoleBadge role={a.role} />
              <StatusBadge status={a.status} />
            </>
          )
        }
        contact={
          a && (
            <>
              <span className="row" style={{ gap: 4 }}>
                <Mail size={14} /> {a.email}
              </span>
              {a.phone && (
                <span className="row" style={{ gap: 4 }}>
                  <Phone size={14} /> {a.phone}
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            <InviteButton userIds={[userId]} names={{ [userId]: name }} disabled={!a} />
            {can("users.accounts.update") && (
              <Button icon={<Pencil />} disabled={!a} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can("users.accounts.deactivate") && !isSelf && (
              <Button variant="danger" icon={<UserX />} disabled={!a} loading={deactivate.isPending} onClick={() => void onDeactivate()}>
                Deactivate
              </Button>
            )}
          </>
        }
      />
      {!a ? (
        <SkeletonBlock lines={8} />
      ) : (
        <>
          {tab === "account" && <AccountTab account={a} />}
          {tab === "access" && (
            <EffectiveAccess
              userId={a.id}
              actions={
                /* The administrator already holds everything */
                can("administration.access.manage") && a.role !== "ADMIN" && (
                  <ButtonLink size="sm" icon={<ShieldPlus />} to={`/administration/access/assignments?userId=${a.id}&add=operator`}>
                    Add operator role
                  </ButtonLink>
                )
              }
            />
          )}
          {tab === "activity" && <ActivityLog basePath="/administration/audit-logs" fixed={{ userId: a.id }} compact title={`What ${a.firstName} did`} />}
          <EditAccountDrawer account={a} open={editing} onClose={() => setEditing(false)} />
        </>
      )}
    </Page>
  );
}

function AccountTab({ account: a }: { account: Account }) {
  const profile = useRoleProfile(a);
  const label = profile.kind === "teacher" ? "Teacher profile" : profile.kind === "staff" ? "Staff profile" : null;
  return (
    <div className="grid-2">
      <Card title="Personal details">
        <DescriptionList
          items={[
            { label: "First name", value: a.firstName },
            { label: "Middle name", value: a.middleName },
            { label: "Last name", value: a.lastName },
            { label: "Email", value: a.email },
            { label: "Phone", value: a.phone },
            { label: "Gender", value: enumLabel(a.gender) },
            { label: "Date of birth", value: formatDate(a.dob) },
            { label: "Address", value: a.address, wide: true }
          ]}
        />
      </Card>
      <div className="stack">
        <Card title="Sign-in">
          <DescriptionList
            items={[
              { label: "Status", value: <StatusBadge status={a.status} /> },
              { label: "Role", value: <RoleBadge role={a.role} /> },
              { label: "Last sign-in", value: a.lastLoginAt ? formatDateTime(a.lastLoginAt) : <span className="muted">Never</span> },
              {
                label: "Password set",
                value: a.passwordChangedAt ? formatDateTime(a.passwordChangedAt) : <span className="muted">Not yet: send an invitation</span>
              },
              { label: "Created", value: formatDateTime(a.createdAt) }
            ]}
          />
        </Card>
        <Card title="Profile">
          {/* One line high whether it is looking up, found or not found */}
          <div className="row" style={{ minHeight: 36 }}>
          {profile.to ? (
            <ButtonLink to={profile.to} icon={<ExternalLink />}>
              Open {label?.toLowerCase()}
              {profile.code ? ` (${profile.code})` : ""}
            </ButtonLink>
          ) : profile.isLoading ? (
            <span className="muted">Looking up the profile…</span>
          ) : profile.searchable ? (
            <span className="muted">No {label?.toLowerCase()} found for this account.</span>
          ) : profile.kind === "student" || profile.kind === "parent" ? (
            <span className="muted">Open the {profile.kind}'s profile from the {profile.kind === "student" ? "Students" : "Parents"} list.</span>
          ) : (
            <span className="muted">You can't open this person's profile.</span>
          )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* Name, email and the rest of the person fields (ADMIN) */
function EditAccountDrawer({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const original = personFromAccount(account);
  const form = useForm(original);
  const save = useApiMutation((body: Record<string, string>) => updateAccount(account.id, body), { invalidate: ["/users"] });
  const emailChanged = form.values.email.trim().toLowerCase() !== account.email.toLowerCase();

  const close = () => {
    form.reset(personFromAccount(account));
    onClose();
  };

  const submit = async () => {
    const invalid = validatePerson(form.values);
    const { body, errors } = patchFrom(original, form.values, PERSON_TEXT_KEYS);
    if (Object.keys(invalid).length || Object.keys(errors).length) {
      form.setErrors({ ...errors, ...invalid });
      return;
    }
    if (!Object.keys(body).length) return close();
    try {
      const res = await save.mutateAsync(body);
      toast.success(res.message);
      onClose();
    } catch (e) {
      form.setServerErrors(e);
      /* 409: the email belongs to another account */
      if (isApiError(e) && e.status === 409) form.setErrors({ email: e.message });
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`Edit ${fullName(account)}`}
      subtitle="Personal details on the account"
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
        {/* The email warning is the email field's hint (its line is reserved), not a banner that pushes the form down */}
        <PersonFields form={form} emailHint={emailChanged ? "Saving a new email signs them out everywhere" : undefined} />
        <div className="small muted">
          Changing the email signs this person out everywhere, cancels their open links and tells the old address.
        </div>
      </form>
    </Drawer>
  );
}
