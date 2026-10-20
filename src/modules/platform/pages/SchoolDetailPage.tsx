import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, MailPlus, RotateCcw } from "lucide-react";
import { errorMessage } from "@/common/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  DescriptionList,
  ErrorState,
  FormActions,
  Page,
  PageHeader,
  PageLoader,
  StatusBadge,
  useConfirm,
  useToast
} from "@/common/ui";
import { formatDate, formatDateTime, fullName } from "@/common/utils/format";
import { useInviteAdmin, useModuleCatalogue, useSchool, useSetModules, useSetStatus, type Invitation, type SchoolDetail } from "../api/schools";
import { InvitationPanel } from "../components/InvitationPanel";
import { ModuleSwitchboard } from "../components/ModuleSwitchboard";

/* PL-04. One school: its profile, administrators, modules and status */
export default function SchoolDetailPage() {
  const { schoolId = "" } = useParams();
  const school = useSchool(schoolId);

  if (school.error) return <Page><ErrorState error={school.error} onRetry={() => void school.refetch()} /></Page>;
  if (!school.data) return <PageLoader />;
  const s = school.data;

  return (
    <Page>
      <PageHeader
        title={s.name}
        subtitle={
          <span className="inline-icon">
            <span className="mono">{s.code}</span> · onboarded {formatDate(s.createdAt)} <StatusBadge status={s.status} />
          </span>
        }
        breadcrumbs={[{ label: "Schools", to: "/platform" }, { label: s.name }]}
      />
      <div className="detail-layout">
        <div className="stack">
          {/* A new answer from the server (a save, another operator's change) starts the switches afresh */}
          <ModulesCard key={s.modules.join(",")} school={s} />
        </div>
        <div className="stack">
          <ProfileCard school={s} />
          <AdminsCard school={s} />
          <StatusCard school={s} />
        </div>
      </div>
    </Page>
  );
}

function ModulesCard({ school }: { school: SchoolDetail }) {
  const catalogue = useModuleCatalogue();
  const save = useSetModules(school.id);
  const toast = useToast();
  const saved = useMemo(() => school.moduleStates.filter(m => !m.core && m.enabled).map(m => m.key), [school.moduleStates]);
  const [value, setValue] = useState(saved);
  const dirty = value.length !== saved.length || value.some(k => !saved.includes(k));
  const switchedOff = saved.filter(k => !value.includes(k));
  const labelOf = (key: string) => catalogue.data?.find(m => m.key === key)?.label ?? key;

  return (
    <Card title="Modules" subtitle="The school sees and uses only the modules switched on. Changes apply at once.">
      {catalogue.error ? (
        <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      ) : !catalogue.data ? (
        <PageLoader />
      ) : (
        <div className="stack">
          <ModuleSwitchboard catalogue={catalogue.data} value={value} onChange={setValue} disabled={save.isPending} />
          {switchedOff.length > 0 && (
            <Alert tone="warning" title={`Switching off ${switchedOff.map(labelOf).join(", ")}`}>
              Its pages disappear for everyone in the school. Its records are kept and come back if you switch it on again.
            </Alert>
          )}
          <FormActions error={save.error ? errorMessage(save.error) : null}>
            <Button disabled={!dirty || save.isPending} onClick={() => setValue(saved)}>
              Discard changes
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!dirty}
              onClick={() => save.mutate(value, { onSuccess: res => toast.success(res.message) })}
            >
              Save modules
            </Button>
          </FormActions>
        </div>
      )}
    </Card>
  );
}

function ProfileCard({ school }: { school: SchoolDetail }) {
  const p = school.profile;
  return (
    <Card title="School details">
      {p ? (
        <DescriptionList
          columns={1}
          items={[
            { label: "Contact email", value: p.contactEmail ?? "—" },
            { label: "Contact phone", value: p.contactPhone ?? "—" },
            { label: "Address", value: p.address ?? "—" },
            { label: "Description", value: p.description, hidden: !p.description },
            { label: "Region", value: `${p.timezone.replace(/_/g, " ")} · ${p.currency} · ${p.country}` }
          ]}
        />
      ) : (
        <p className="muted">The school is suspended: its details are hidden until it is reactivated.</p>
      )}
    </Card>
  );
}

function AdminsCard({ school }: { school: SchoolDetail }) {
  const invite = useInviteAdmin(school.id);
  const toast = useToast();
  const [sent, setSent] = useState<{ invitation: Invitation; email: string } | null>(null);
  if (!school.profile) return null;
  return (
    <Card title="Administrators" subtitle="The school's administrators manage everyone else from inside the school">
      <div className="stack">
        {school.admins.map(a => (
          <div key={a.id} className="admin-row">
            <div className="school-cell">
              <span className="school-cell-name">{fullName(a, true)}</span>
              <span className="small muted">{a.email}{a.phone ? ` · ${a.phone}` : ""}</span>
              <span className="small muted">{a.lastLoginAt ? `Last signed in ${formatDateTime(a.lastLoginAt)}` : "Has not signed in yet"}</span>
            </div>
            {a.invitationPending ? (
              <span className="stack-sm admin-row-end">
                <Badge tone="warning">Invitation pending</Badge>
                <Button
                  size="sm"
                  icon={<MailPlus size={14} />}
                  loading={invite.isPending && invite.variables === a.id}
                  onClick={() =>
                    invite.mutate(a.id, {
                      onSuccess: res => {
                        toast.success(res.message);
                        setSent({ invitation: res.data, email: a.email });
                      },
                      onError: err => toast.error(err)
                    })
                  }
                >
                  New link
                </Button>
              </span>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
          </div>
        ))}
        {sent && <InvitationPanel invitation={sent.invitation} email={sent.email} />}
      </div>
    </Card>
  );
}

function StatusCard({ school }: { school: SchoolDetail }) {
  const setStatus = useSetStatus(school.id);
  const confirm = useConfirm();
  const toast = useToast();
  const active = school.status === "ACTIVE";

  const change = async () => {
    const ok = await confirm(
      active
        ? {
            title: `Suspend ${school.name}?`,
            message: "Nobody in the school can sign in or use it until it is reactivated. Its records are kept.",
            confirmLabel: "Suspend school",
            tone: "danger"
          }
        : { title: `Reactivate ${school.name}?`, message: "Everyone in the school can sign in again.", confirmLabel: "Reactivate", tone: "primary" }
    );
    if (!ok) return;
    setStatus.mutate(active ? "SUSPENDED" : "ACTIVE", { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  return (
    <Card title="Status">
      <div className="stack-sm">
        <p className="muted">{active ? "The school is active. Suspend it to lock everyone out without losing data." : "The school is suspended: nobody can sign in."}</p>
        <div>
          <Button
            variant={active ? "danger" : "primary"}
            icon={active ? <Ban size={15} /> : <RotateCcw size={15} />}
            loading={setStatus.isPending}
            onClick={() => void change()}
          >
            {active ? "Suspend school" : "Reactivate school"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
