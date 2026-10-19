import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  ErrorState,
  Page,
  Skeleton,
  SkeletonBlock,
  useConfirm,
  useToast
} from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useDeleteOperatorRole, useGrantableCatalogue, useOperatorRole, type OperatorRole, type PermissionDetail } from "../api/access";
import { ASSIGNMENTS_PATH, ROLES_PATH, rolePath } from "../utils/paths";
import "../access.css";

/* AD-04: one role, its permissions and who holds it. A drill-in page: back to the roles. */
export default function OperatorRoleDetailPage() {
  const { operatorRoleId } = useParams();
  const role = useOperatorRole(operatorRoleId);

  return (
    <Page>
      <DrillHeader back={ROLES_PATH} backLabel="Back to operator roles" title={role.data?.name ?? "Operator role"} />
      {role.error ? (
        <ErrorState error={role.error} onRetry={() => void role.refetch()} />
      ) : !role.data ? (
        <>
          <div className="row-between" style={{ minHeight: 34 }}>
            <Skeleton width={280} />
          </div>
          <Card title="Details">
            <SkeletonBlock lines={4} />
          </Card>
          <Card title="Permissions" subtitle="What everyone holding this role can do">
            <SkeletonBlock lines={6} />
          </Card>
        </>
      ) : (
        <RoleDetail role={role.data} />
      )}
    </Page>
  );
}

function RoleDetail({ role }: { role: OperatorRole }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const remove = useDeleteOperatorRole();
  const canManage = can("administration.access.manage") && can(`${role.module}.access.manage`);
  const holdersLink = `${ASSIGNMENTS_PATH}?operatorRoleId=${role.id}&module=${role.module}`;

  const onDelete = async () => {
    /* A role still held can't go: say so in the dialog instead of a banner on the page */
    if (role.holders) {
      const see = await confirm({
        title: `${role.name} can't be deleted yet`,
        message: `${role.holders} ${role.holders === 1 ? "person holds" : "people hold"} it now or later. Revoke their assignments first.`,
        confirmLabel: "See holders",
        tone: "primary"
      });
      if (see) navigate(holdersLink);
      return;
    }
    const ok = await confirm({
      title: `Delete ${role.name}?`,
      message: `The ${role.moduleLabel} role ${role.name} will be removed. This can't be undone.`,
      confirmLabel: "Delete role"
    });
    if (!ok) return;
    remove.mutate(role.id, {
      onSuccess: res => {
        toast.success(res.message);
        navigate(ROLES_PATH, { replace: true });
      },
      /* 409: someone was given it meanwhile */
      onError: e => toast.error(errorMessage(e))
    });
  };

  return (
    <>
      <div className="row-between" style={{ minHeight: 34 }}>
        <span className="row" style={{ minWidth: 0 }}>
          <Badge>{role.moduleLabel}</Badge>
          <span className="muted">{role.description ?? "Operator role"}</span>
        </span>
        {canManage && (
          <div className="row">
            <Button icon={<Trash2 />} onClick={() => void onDelete()} loading={remove.isPending}>
              Delete
            </Button>
            <ButtonLink icon={<UserPlus />} to={`${holdersLink}&add=operator`}>
              Assign to someone
            </ButtonLink>
            <ButtonLink variant="primary" icon={<Pencil />} to={`${rolePath(role.id)}/edit`}>
              Edit
            </ButtonLink>
          </div>
        )}
      </div>
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
    </>
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
