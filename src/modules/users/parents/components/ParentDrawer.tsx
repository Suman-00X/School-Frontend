import { useState, type FormEvent } from "react";
import { Pencil, UserCog } from "lucide-react";
import type { Account } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { Alert, Button, ButtonLink, DescriptionList, Drawer, ErrorState, Skeleton, StatusBadge, useToast, type DLItem } from "@/common/ui";
import { formatDate, formatDateTime, formatMoney, fullName, enumLabel } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { nestedFieldMap, patchFrom, useSchoolCurrency } from "@/modules/users/shared";
import { updateParent, useParent, type Parent } from "../api/parents";
import { PARENT_PROFILE_KEYS, PARENT_PROFILE_TEXT_KEYS, parentProfileFrom, validateParentProfile } from "../utils/profile";
import { ParentProfileFields } from "./ParentProfileFields";

/* PE-04 detail: contact, profile, account, children (gap). Viewing and editing are two drawers
   in the same place; each keeps its layout while its data loads (skeleton values in the same lists). */
export function ParentDrawer({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  /* Keyed so another parent opens in view mode */
  return <ParentDrawerFor key={parentId ?? ""} parentId={parentId} onClose={onClose} />;
}

function ParentDrawerFor({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const parent = useParent(parentId);
  const [editing, setEditing] = useState(false);
  const p = parent.data;

  if (p && editing) return <EditParentDrawer parent={p} onClose={() => setEditing(false)} />;

  return (
    <Drawer
      open={!!parentId}
      onClose={onClose}
      title={p ? fullName(p.user) : "Parent"}
      subtitle={p ? <span className="mono">{p.parentCode}</span> : "Loading…"}
      /* The footer is there from the start; its buttons wait for the record */
      footer={
        <>
          {can("users.accounts.update") && (
            <ButtonLink to={p ? `/users/${p.userId}` : "#"} icon={<UserCog />}>
              Edit account
            </ButtonLink>
          )}
          <InviteButton userIds={p ? [p.userId] : []} names={p ? { [p.userId]: fullName(p.user) } : {}} />
          {can("users.parents.update") && (
            <Button variant="primary" icon={<Pencil />} disabled={!p} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </>
      }
    >
      {parent.error ? <ErrorState error={parent.error} onRetry={() => void parent.refetch()} /> : <ParentDetails parent={p} />}
    </Drawer>
  );
}

const wait = (width = "60%") => <Skeleton width={width} />;

function ParentDetails({ parent: p }: { parent: Parent | undefined }) {
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const canAccount = can("users.accounts.read");
  const account = useApiGet<Account>(canAccount && p ? `/users/${p.userId}` : null);
  const a = account.data;
  /* While the account loads its section shows skeletons; it is left out only if it can't be read */
  const accountItems: DLItem[] = [
    { label: "Status", value: a ? <StatusBadge status={a.status} /> : wait("40%") },
    { label: "Gender", value: a ? enumLabel(a.gender) : wait("40%") },
    { label: "Date of birth", value: a ? formatDate(a.dob) : wait("50%") },
    { label: "Last sign-in", value: a ? (a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never") : wait() },
    { label: "Password set", value: a ? (a.passwordChangedAt ? formatDateTime(a.passwordChangedAt) : "Not yet (invite them)") : wait() },
    { label: "Address", value: a ? a.address : wait("80%"), wide: true }
  ];
  return (
    <div className="stack">
      <div className="section-title">Contact</div>
      <DescriptionList
        items={[
          { label: "Email", value: p ? p.user.email : wait() },
          { label: "Phone", value: p ? p.user.phone : wait("50%") }
        ]}
      />
      <div className="section-title">Profile</div>
      <DescriptionList
        items={[
          { label: "Occupation", value: p ? p.occupation : wait("50%") },
          { label: "Annual income", value: p ? (p.annualIncome !== null ? formatMoney(p.annualIncome, currency) : null) : wait("40%") },
          { label: "Notes", value: p ? p.description : wait("80%"), wide: true }
        ]}
      />
      {canAccount && !account.error && (
        <>
          <div className="section-title">Account</div>
          <DescriptionList items={accountItems} />
        </>
      )}
      <div className="section-title">Children</div>
      <Alert tone="info">
        The API can't list a parent's children yet: links are readable only from each student's profile (Parents tab). Needs{" "}
        <span className="mono">GET /users/parents/:parentId/students</span>.
      </Alert>
    </div>
  );
}

/* Profile fields only; name, email and phone are on the account. Errors go in the footer. */
function EditParentDrawer({ parent, onClose }: { parent: Parent; onClose: () => void }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const original = parentProfileFrom(parent);
  const form = useForm(original);
  const save = useApiMutation(updateParent, { invalidate: ["/users/parents"] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors = validateParentProfile(form.values);
    const { body, errors: clearErrors } = patchFrom(original, form.values, PARENT_PROFILE_TEXT_KEYS);
    Object.assign(errors, clearErrors);
    if (Object.keys(errors).length) return form.setErrors(errors);
    if (!Object.keys(body).length) return onClose();
    const { annualIncome, ...text } = body;
    save.mutate(
      { parentId: parent.id, ...text, ...(annualIncome !== undefined && { annualIncome: Number(annualIncome) }) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err, nestedFieldMap("profile", PARENT_PROFILE_KEYS))
      }
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Edit ${fullName(parent.user)}`}
      subtitle={<span className="mono">{parent.parentCode}</span>}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-parent" variant="primary" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-parent" className="stack" onSubmit={submit} noValidate>
        <ParentProfileFields form={form} currency={currency} disabled={save.isPending} />
        <div className="small muted">Name, email and phone are on the account (ADMIN: "Edit account").</div>
      </form>
    </Drawer>
  );
}
