import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Link2, Star, Unlink, UserPlus, UsersRound } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Card, DataTable, Dialog, Drawer, EmptyState, Select, Switch, useConfirm, useToast, type Column } from "@/common/ui";
import { enumLabel, enumOptions, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { PARENT_RELATIONS, PERSON_KEYS, PersonFields, emptyPerson, nestedFieldMap, personPayload, useSchoolCurrency, validatePerson } from "@/modules/users/shared";
import {
  PARENT_PROFILE_KEYS,
  ParentPicker,
  ParentProfileFields,
  createParent,
  emptyParentProfile,
  parentProfilePayload,
  validateParentProfile,
  type Parent
} from "@/modules/users/parents";
import { linkParent, unlinkParent, useStudentParents, type ParentRelation, type Student, type StudentParent } from "../api/students";

const relationOptions = enumOptions(PARENT_RELATIONS);

export function ParentsTab({ student }: { student: Student }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const links = useStudentParents(student.id);
  const [dialog, setDialog] = useState<"link" | "add" | null>(null);
  const canManage = can("users.students.manageParents");
  const unlink = useApiMutation(unlinkParent, { invalidate: ["/users/students"] });

  const rows = links.rows ?? [];
  const names = Object.fromEntries(rows.map(l => [l.parent.user.id, fullName(l.parent.user)]));
  const hasPrimary = rows.some(l => l.isPrimaryContact);

  const onUnlink = async (l: StudentParent) => {
    const ok = await confirm({
      title: "Unlink parent",
      message: `Unlink ${fullName(l.parent.user)} (${enumLabel(l.relation).toLowerCase()}) from ${fullName(student.user)}? The parent's account stays.`,
      confirmLabel: "Unlink"
    });
    if (!ok) return;
    unlink.mutate({ studentId: student.id, parentId: l.parentId }, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const columns: Column<StudentParent>[] = [
    {
      key: "name",
      header: "Name",
      render: l =>
        can("users.parents.read") ? (
          <Link to={`/users/parents?parent=${l.parentId}`} onClick={e => e.stopPropagation()}>
            {fullName(l.parent.user)}
          </Link>
        ) : (
          fullName(l.parent.user)
        )
    },
    { key: "relation", header: "Relation", render: l => enumLabel(l.relation) },
    {
      key: "primary",
      header: "Primary",
      align: "center",
      width: 80,
      render: l => (l.isPrimaryContact ? <Star size={16} fill="currentColor" aria-label="Primary contact" /> : null)
    },
    { key: "phone", header: "Phone", render: l => l.parent.user.phone ?? <span className="muted">—</span> },
    { key: "email", header: "Email", render: l => l.parent.user.email },
    { key: "code", header: "Parent code", render: l => <span className="mono">{l.parent.parentCode}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: l => (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <InviteButton size="sm" variant="ghost" label="Invite" userIds={[l.parent.user.id]} names={names} />
          {canManage && (
            <Button size="sm" variant="ghost" icon={<Unlink />} onClick={() => void onUnlink(l)}>
              Unlink
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <Card
      flush
      title="Parents and guardians"
      /* Always one line: the missing-primary note takes the place of the usual text, not a banner above the table */
      subtitle={
        links.rows && rows.length > 0 && !hasPrimary ? (
          <span style={{ color: "var(--warning-text)" }}>No primary contact: links can't be edited, so unlink a parent and link them again as primary.</span>
        ) : (
          "The primary contact is called first."
        )
      }
      actions={
        <>
          {/* Kept in place (hidden) with fewer than two parents, so the other buttons don't move */}
          <span style={{ visibility: rows.length > 1 ? undefined : "hidden" }}>
            <InviteButton size="sm" label="Invite all" userIds={rows.map(l => l.parent.user.id)} names={names} />
          </span>
          {canManage && can("users.parents.read") && (
            <Button size="sm" icon={<Link2 />} onClick={() => setDialog("link")}>
              Link existing parent
            </Button>
          )}
          {canManage && can("users.parents.create") && (
            <Button size="sm" variant="primary" icon={<UserPlus />} onClick={() => setDialog("add")}>
              Add new parent
            </Button>
          )}
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={links.rows}
        rowKey={l => l.id}
        loading={links.isLoading}
        error={links.error}
        onRetry={() => void links.refetch()}
        empty={<EmptyState icon={<UsersRound />} title="No parents linked" message="Link an existing parent or add a new one." />}
      />
      {dialog === "link" && <LinkParentDialog student={student} linkedIds={rows.map(l => l.parentId)} hasPrimary={hasPrimary} onClose={() => setDialog(null)} />}
      {dialog === "add" && <AddParentDrawer student={student} hasPrimary={hasPrimary} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function LinkFields({
  relation,
  primary,
  onRelation,
  onPrimary,
  error
}: {
  relation: string;
  primary: boolean;
  onRelation: (r: string) => void;
  onPrimary: (p: boolean) => void;
  error?: string;
}) {
  return (
    <div className="form-grid">
      <Select label="Relation" required placeholder="Choose" options={relationOptions} value={relation} error={error} onChange={e => onRelation(e.target.value)} />
      <div className="field" style={{ justifyContent: "flex-end" }}>
        <Switch label="Primary contact" checked={primary} onChange={onPrimary} />
      </div>
    </div>
  );
}

function LinkParentDialog({ student, linkedIds, hasPrimary, onClose }: { student: Student; linkedIds: string[]; hasPrimary: boolean; onClose: () => void }) {
  const toast = useToast();
  const [parent, setParent] = useState<Parent | null>(null);
  const [relation, setRelation] = useState("");
  const [primary, setPrimary] = useState(!hasPrimary);
  const [error, setError] = useState<string | null>(null);
  const link = useApiMutation(linkParent, { invalidate: ["/users/students"] });

  const submit = () => {
    if (!parent) return setError("Choose a parent.");
    if (!relation) return setError("Choose the relation.");
    link.mutate(
      { studentId: student.id, parentId: parent.id, relation: relation as ParentRelation, isPrimaryContact: primary },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        /* 409 already linked, 422 unknown parent */
        onError: e => setError(isApiError(e) ? e.message : "Something went wrong. Please try again.")
      }
    );
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={`Link a parent to ${fullName(student.user)}`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={link.isPending} onClick={submit}>
            Link parent
          </Button>
        </>
      }
    >
      <div className="stack">
        <ParentPicker value={parent} onChange={p => {
            setParent(p);
            setError(null);
          }} exclude={linkedIds} />
        <LinkFields relation={relation} primary={primary} onRelation={r => {
            setRelation(r);
            setError(null);
          }} onPrimary={setPrimary} />
      </div>
    </Dialog>
  );
}

/* New parent account + profile, then the link: two calls, so a failed link leaves the parent created */
function AddParentDrawer({ student, hasPrimary, onClose }: { student: Student; hasPrimary: boolean; onClose: () => void }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const person = useForm(emptyPerson());
  const profile = useForm(emptyParentProfile());
  const [relation, setRelation] = useState("");
  const [relationError, setRelationError] = useState<string>();
  const [primary, setPrimary] = useState(!hasPrimary);
  /* Set once the parent exists, so a retry only links */
  const [created, setCreated] = useState<Parent | null>(null);
  const create = useApiMutation(createParent, { invalidate: ["/users/parents"] });
  const link = useApiMutation(linkParent, { invalidate: ["/users/students"] });
  const busy = create.isPending || link.isPending;

  const doLink = (parent: Parent) =>
    link.mutate(
      { studentId: student.id, parentId: parent.id, relation: relation as ParentRelation, isPrimaryContact: primary },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: e => person.setFormError(`${fullName(parent.user)} was created but not linked: ${isApiError(e) ? e.message : "please try again"}.`)
      }
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (created) return doLink(created);
    const personErrors = validatePerson(person.values);
    const profileErrors = validateParentProfile(profile.values);
    person.setErrors(personErrors);
    profile.setErrors(profileErrors);
    setRelationError(relation ? undefined : "is required");
    person.setFormError(null);
    if (Object.keys(personErrors).length || Object.keys(profileErrors).length || !relation) return;
    create.mutate(
      { user: personPayload(person.values), profile: parentProfilePayload(profile.values) },
      {
        onSuccess: res => {
          setCreated(res.data);
          doLink(res.data);
        },
        onError: err => {
          if (isApiError(err) && err.status === 409 && /email/i.test(err.message))
            return person.setErrors({ email: `${err.message}. Use "Link existing parent" if it's this parent.` });
          person.setServerErrors(err, nestedFieldMap("user", PERSON_KEYS));
          if (isApiError(err) && err.isValidation) profile.setServerErrors(err, nestedFieldMap("profile", PARENT_PROFILE_KEYS));
        }
      }
    );
  };

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title="Add a new parent"
      subtitle={`Linked to ${fullName(student.user)}`}
      footerStatus={person.formError}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-parent" variant="primary" loading={busy}>
            {created ? "Link parent" : "Create and link"}
          </Button>
        </>
      }
    >
      <form id="add-parent" className="stack" onSubmit={submit} noValidate>
        <div className="section-title">Personal details</div>
        <PersonFields form={person} disabled={busy || !!created} />
        <div className="section-title">Profile</div>
        <ParentProfileFields form={profile} currency={currency} disabled={busy || !!created} />
        <div className="section-title">Link</div>
        <LinkFields
          relation={relation}
          primary={primary}
          onRelation={r => {
            setRelation(r);
            setRelationError(undefined);
          }}
          onPrimary={setPrimary}
          error={relationError}
        />
      </form>
    </Drawer>
  );
}
