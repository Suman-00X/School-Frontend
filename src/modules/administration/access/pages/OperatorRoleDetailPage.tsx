import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  ErrorState,
  Page,
  PageHeader,
  SkeletonBlock,
  useConfirm,
  useToast
} from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useDeleteOperatorRole, useGrantableCatalogue, useOperatorRole, type OperatorRole, type PermissionDetail } from "../api/access";
import "../access.css";

/* AD-04: one role, its permissions and who holds it */
export default function OperatorRoleDetailPage() {
  const { operatorRoleId } = useParams();
  const role = useOperatorRole(operatorRoleId);

  if (role.error)
    return (
      <Page>
        <ErrorState error={role.error} onRetry={() => void role.refetch()} />
      </Page>
    );
  if (!role.data)
    return (
      <Page>
        <PageHeader title="Operator role" breadcrumbs={[{ label: "Operator roles", to: "/administration/access/operator-roles" }]} />
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      </Page>
    );
  return <RoleDetail role={role.data} />;
}

function RoleDetail({ role }: { role: OperatorRole }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const remove = useDeleteOperatorRole();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canManage = can("administration.access.manage") && can(`${role.module}.access.manage`);
  const holdersLink = `/administration/access/assignments?operatorRoleId=${role.id}&module=${role.module}`;

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${role.name}?`,
      message: `The ${role.moduleLabel} role ${role.name} will be removed. This can't be undone.`,
      confirmLabel: "Delete role"
    });
    if (!ok) return;
    setDeleteError(null);
    remove.mutate(role.id, {
      onSuccess: res => {
        toast.success(res.message);
        navigate("/administration/access/operator-roles", { replace: true });
      },
      /* 409: still held by someone */
      onError: e => (isApiError(e) && e.status === 409 ? setDeleteError(e.message) : toast.error(errorMessage(e)))
    });
  };

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: "Operator roles", to: "/administration/access/operator-roles" }, { label: role.name }]}
        title={
          <span className="row">
            {role.name} <Badge>{role.moduleLabel}</Badge>
          </span>
        }
        subtitle={role.description ?? undefined}
        actions={
          canManage && (
            <>
              <Button icon={<Trash2 />} onClick={() => void onDelete()} loading={remove.isPending}>
                Delete
              </Button>
              <ButtonLink icon={<UserPlus />} to={`/administration/access/assignments?operatorRoleId=${role.id}&module=${role.module}&add=operator`}>
                Assign to someone
              </ButtonLink>
              <ButtonLink variant="primary" icon={<Pencil />} to={`/administration/access/operator-roles/${role.id}/edit`}>
                Edit
              </ButtonLink>
            </>
          )
        }
      />
      {deleteError && (
        <Alert tone="danger" title="This role can't be deleted yet" action={<ButtonLink size="sm" to={holdersLink}>See holders</ButtonLink>}>
          {deleteError}
        </Alert>
      )}
      <Card title="Details">
        <DescriptionList
          columns={3}
          items={[
            { label: "Module", value: role.moduleLabel },
            {
              label: "Holders",
              value: <Link to={holdersLink}>{role.holders ? `${role.holders} now or upcoming` : "Nobody yet"}</Link>
            },
            { label: "Permissions", value: role.permissions.length },
            { label: "Description", value: role.description, wide: true },
            { label: "Updated", value: formatDateTime(role.updatedAt) },
            { label: "Created", value: formatDateTime(role.createdAt) }
          ]}
        />
      </Card>
      <Card title="Permissions" subtitle="What everyone holding this role can do">
        <PermissionList role={role} />
      </Card>
    </Page>
  );
}

/* Grouped by resource (labels from the catalogue when it is loaded) */
function PermissionList({ role }: { role: OperatorRole }) {
  const catalogue = useGrantableCatalogue(role.module);
  const groups = useMemo(() => {
    const labelOf = new Map<string, string>();
    for (const m of catalogue.data ?? []) for (const r of m.resources) labelOf.set(r.resource, r.label);
    const map = new Map<string, PermissionDetail[]>();
    for (const p of role.permissionDetails) {
      const resource = p.key.split(".")[1] ?? "";
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(p);
    }
    return [...map].map(([resource, perms]) => ({ resource, label: labelOf.get(resource) ?? resource, perms }));
  }, [catalogue.data, role.permissionDetails]);

  return (
    <div className="stack">
      {groups.map(g => (
        <div key={g.resource}>
          <div className="section-title" style={{ marginBottom: 6 }}>
            {g.label}
          </div>
          <ul className="stack-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {g.perms.map(p => (
              <li key={p.key}>
                <span className={p.available ? undefined : "perm-gone"}>{p.label}</span>
                {!p.available && (
                  <>
                    {" "}
                    <Badge tone="warning">No longer grants anything</Badge>
                  </>
                )}
                <span className="perm-key">{p.key}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
