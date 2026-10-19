import { useState, type FormEvent } from "react";
import { Pencil, UserCog } from "lucide-react";
import type { Account } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { Alert, Button, ButtonLink, DescriptionList, Drawer, ErrorState, SkeletonBlock, StatusBadge, useToast } from "@/common/ui";
import { formatDate, formatDateTime, formatMoney, fullName, enumLabel } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { nestedFieldMap, patchFrom, useSchoolCurrency } from "@/modules/users/shared";
import { updateParent, useParent, type Parent } from "../api/parents";
import { PARENT_PROFILE_KEYS, PARENT_PROFILE_TEXT_KEYS, parentProfileFrom, validateParentProfile } from "../utils/profile";
import { ParentProfileFields } from "./ParentProfileFields";

/* PE-04 detail: contact, profile, account, children (gap) — view and edit the profile fields */
export function ParentDrawer({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  /* Keyed so another parent opens in view mode */
  return <ParentDrawerFor key={parentId ?? ""} parentId={parentId} onClose={onClose} />;
}

function ParentDrawerFor({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const parent = useParent(parentId);
  const [editing, setEditing] = useState(false);
  const p = parent.data;

  return (
    <Drawer
      open={!!parentId}
      onClose={onClose}
      title={p ? fullName(p.user) : "Parent"}
      subtitle={p && <span className="mono">{p.parentCode}</span>}
      footer={
        p &&
        !editing && (
          <>
            {can("users.accounts.update") && (
              <ButtonLink to={`/users/${p.userId}`} icon={<UserCog />}>
                Edit account
              </ButtonLink>
            )}
            <InviteButton userIds={[p.userId]} names={{ [p.userId]: fullName(p.user) }} />
            {can("users.parents.update") && (
              <Button variant="primary" icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        )
      }
    >
      {parent.isLoading && <SkeletonBlock lines={8} />}
      {parent.error && <ErrorState error={parent.error} onRetry={() => void parent.refetch()} />}
      {p && (editing ? <EditProfile parent={p} onDone={() => setEditing(false)} /> : <ParentDetails parent={p} />)}
    </Drawer>
  );
}

function ParentDetails({ parent: p }: { parent: Parent }) {
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const account = useApiGet<Account>(can("users.accounts.read") ? `/users/${p.userId}` : null);
  const a = account.data;
  return (
    <div className="stack">
      <div className="section-title">Contact</div>
      <DescriptionList
        items={[
          { label: "Email", value: p.user.email },
          { label: "Phone", value: p.user.phone }
        ]}
      />
      <div className="section-title">Profile</div>
      <DescriptionList
        items={[
          { label: "Occupation", value: p.occupation },
          { label: "Annual income", value: p.annualIncome !== null ? formatMoney(p.annualIncome, currency) : null },
          { label: "Notes", value: p.description, wide: true }
        ]}
      />
      {a && (
        <>
          <div className="section-title">Account</div>
          <DescriptionList
            items={[
              { label: "Status", value: <StatusBadge status={a.status} /> },
              { label: "Gender", value: enumLabel(a.gender) },
              { label: "Date of birth", value: formatDate(a.dob) },
              { label: "Last sign-in", value: a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never" },
              { label: "Password set", value: a.passwordChangedAt ? formatDateTime(a.passwordChangedAt) : "Not yet (invite them)" },
              { label: "Address", value: a.address, wide: true }
            ]}
          />
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

function EditProfile({ parent, onDone }: { parent: Parent; onDone: () => void }) {
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
    if (!Object.keys(body).length) return onDone();
    const { annualIncome, ...text } = body;
    save.mutate(
      { parentId: parent.id, ...text, ...(annualIncome !== undefined && { annualIncome: Number(annualIncome) }) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone();
        },
        onError: err => form.setServerErrors(err, nestedFieldMap("profile", PARENT_PROFILE_KEYS))
      }
    );
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <ParentProfileFields form={form} currency={currency} disabled={save.isPending} />
      <div className="small muted">Name, email and phone are on the account (ADMIN: "Edit account").</div>
      <div className="form-actions">
        <Button onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
