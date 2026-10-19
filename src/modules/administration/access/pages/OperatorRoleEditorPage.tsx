import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  Select,
  SkeletonBlock,
  TextInput,
  Textarea,
  useToast
} from "@/common/ui";
import {
  useCreateOperatorRole,
  useGrantableCatalogue,
  useManagedModules,
  useOperatorRole,
  useUpdateOperatorRole,
  type OperatorRole
} from "../api/access";
import { PermissionTree } from "../components/PermissionTree";
import "../access.css";

const MAX_PERMISSIONS = 100;

/* AD-04: new role (/new) and edit (/:operatorRoleId/edit) */
export default function OperatorRoleEditorPage() {
  const { operatorRoleId } = useParams();
  const role = useOperatorRole(operatorRoleId);

  if (!operatorRoleId) return <RoleEditor />;
  if (role.error)
    return (
      <Page>
        <ErrorState error={role.error} onRetry={() => void role.refetch()} />
      </Page>
    );
  if (!role.data)
    return (
      <Page>
        <PageHeader title="Edit operator role" />
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      </Page>
    );
  return <RoleEditor role={role.data} />;
}

type Values = { module: string; name: string; description: string };

function RoleEditor({ role }: { role?: OperatorRole }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [search] = useSearchParams();
  const { modules, isLoading: modulesLoading } = useManagedModules();
  const create = useCreateOperatorRole();
  const update = useUpdateOperatorRole(role?.id ?? "");
  const saving = create.isPending || update.isPending;

  const form = useForm<Values>({
    module: role?.module ?? search.get("module") ?? "",
    name: role?.name ?? "",
    description: role?.description ?? ""
  });
  /* Keys no longer grantable are dropped on save */
  const gone = useMemo(() => role?.permissionDetails.filter(p => !p.available) ?? [], [role]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role?.permissionDetails.filter(p => p.available).map(p => p.key) ?? [])
  );

  /* One module only: pick it */
  useEffect(() => {
    if (!role && !form.values.module && modules.length === 1) form.set("module", modules[0].value);
  }, [modules]); // eslint-disable-line react-hooks/exhaustive-deps

  const module = form.values.module;
  const catalogue = useGrantableCatalogue(module || undefined, !!module);
  const tree = catalogue.data?.find(m => m.module === module);

  const pickModule = (next: string) => {
    form.set("module", next);
    setSelected(new Set());
  };

  const back = () => navigate(role ? `/administration/access/operator-roles/${role.id}` : "/administration/access/operator-roles");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!module) errors.module = "is required";
    if (!form.values.name.trim()) errors.name = "is required";
    if (selected.size === 0) errors.permissions = "pick at least one permission";
    if (selected.size > MAX_PERMISSIONS) errors.permissions = `a role can hold up to ${MAX_PERMISSIONS} permissions`;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      return;
    }
    form.setFormError(null);
    const permissions = [...selected].sort();
    const onError = (err: unknown) => {
      /* 409: the name is taken in this module */
      if (isApiError(err) && err.status === 409) {
        form.setErrors({ name: err.message });
        form.setFormError(null);
      } else form.setServerErrors(err);
    };

    if (!role) {
      create.mutate(
        { module, name: form.values.name.trim(), description: form.values.description.trim() || undefined, permissions },
        {
          onSuccess: res => {
            toast.success(res.message);
            navigate(`/administration/access/operator-roles/${res.data.id}`, { replace: true });
          },
          onError
        }
      );
      return;
    }

    const changes: { name?: string; description?: string; permissions?: string[] } = {};
    if (form.values.name.trim() !== role.name) changes.name = form.values.name.trim();
    if (form.values.description.trim() !== (role.description ?? "")) changes.description = form.values.description.trim();
    if (JSON.stringify(permissions) !== JSON.stringify([...role.permissions].sort())) changes.permissions = permissions;
    if (!Object.keys(changes).length) return back();
    update.mutate(changes, {
      onSuccess: res => {
        toast.success(res.message);
        back();
      },
      onError
    });
  };

  const noModules = !role && !modulesLoading && modules.length === 0;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Operator roles", to: "/administration/access/operator-roles" },
          ...(role ? [{ label: role.name, to: `/administration/access/operator-roles/${role.id}` }] : [])
        ]}
        title={role ? `Edit ${role.name}` : "New operator role"}
        subtitle={role ? `${role.moduleLabel} module` : "Bundle permissions of one module to give to staff"}
      />
      {noModules ? (
        <EmptyState title="No module to add roles to" message="Operator roles belong to an add-on module you administer." />
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Card title="Role">
            <div className="form-grid">
              {role ? (
                <TextInput label="Module" value={role.moduleLabel} disabled readOnly hint="A role's module never changes." />
              ) : (
                <Select
                  label="Module"
                  required
                  placeholder="Choose a module"
                  options={modules}
                  value={module}
                  error={form.errors.module}
                  onChange={e => pickModule(e.target.value)}
                  disabled={saving}
                />
              )}
              <TextInput label="Name" required maxLength={100} placeholder="e.g. Library desk" {...form.text("name")} disabled={saving} />
              <Textarea
                label="Description"
                rows={2}
                maxLength={500}
                fieldClassName="span-2"
                placeholder="What the people holding it do"
                {...form.text("description")}
                disabled={saving}
              />
            </div>
          </Card>

          <Card
            title="Permissions"
            subtitle={tree ? `${selected.size} selected` : undefined}
            actions={
              tree && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(tree.resources.flatMap(r => r.permissions.map(p => p.key))))} disabled={saving}>
                    Select all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={saving || selected.size === 0}>
                    Clear
                  </Button>
                </>
              )
            }
          >
            <div className="stack">
              {form.errors.permissions && <Alert tone="danger">Permissions: {form.errors.permissions}</Alert>}
              {gone.length > 0 && (
                <Alert tone="warning" title="Dropped when you save">
                  {gone.map(p => p.label).join(", ")} no longer grant anything to operators.
                </Alert>
              )}
              {!module ? (
                <div className="muted">Choose a module to see its permissions.</div>
              ) : catalogue.error ? (
                <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
              ) : !tree ? (
                <SkeletonBlock lines={6} />
              ) : (
                <PermissionTree catalogue={tree} selected={selected} onChange={setSelected} disabled={saving} />
              )}
            </div>
          </Card>

          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          <div className="stack-sm" style={{ alignItems: "flex-end" }}>
            <div className="form-actions">
              <Button onClick={back} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {role ? "Save changes" : "Create role"}
              </Button>
            </div>
            {role && <div className="small muted">Changes apply to everyone holding this role on their next request.</div>}
          </div>
        </form>
      )}
    </Page>
  );
}
