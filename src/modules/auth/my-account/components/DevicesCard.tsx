import { useState } from "react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, Card, DataTable, useConfirm, useToast } from "@/common/ui";
import { describeUserAgent, formatDateTime, relativeTime } from "@/common/utils/format";
import { revokeSession, SESSIONS_PATH, type DeviceSession } from "../../sessions/api/sessions";

export function DevicesCard() {
  const { signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useApiGet<DeviceSession[]>(SESSIONS_PATH);
  const [busyId, setBusyId] = useState<string | null>(null);

  const signOutDevice = async (s: DeviceSession) => {
    const device = describeUserAgent(s.userAgent);
    if (s.current) {
      const ok = await confirm({ title: "Sign out here?", message: "You will need to sign in again on this device.", confirmLabel: "Sign out" });
      if (ok) await signOut();
      return;
    }
    const ok = await confirm({
      title: "Sign out this device?",
      message: `${device}${s.ipAddress ? ` (${s.ipAddress})` : ""}, last active ${relativeTime(s.lastUsedAt)}, will need to sign in again.`,
      confirmLabel: "Sign out device"
    });
    if (!ok) return;
    setBusyId(s.id);
    try {
      await revokeSession(s.id);
      toast.success("That device has been signed out");
    } catch (err) {
      /* Already gone (expired or signed out elsewhere): the refreshed list shows it */
      if (!(isApiError(err) && err.status === 404)) toast.error(err);
    } finally {
      setBusyId(null);
      void refetch();
    }
  };

  const rows = data ? [...data].sort((a, b) => Number(b.current) - Number(a.current)) : undefined;

  return (
    <Card title="Signed-in devices" subtitle="Sign out any device you don't recognise." flush>
      <DataTable
        rows={rows}
        rowKey={s => s.id}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        columns={[
          {
            key: "device",
            header: "Device",
            render: s => (
              <div className="row">
                <span>{describeUserAgent(s.userAgent)}</span>
                {s.current && <Badge tone="success">This device</Badge>}
              </div>
            )
          },
          { key: "ipAddress", header: "IP address", render: s => <span className="mono">{s.ipAddress ?? "—"}</span> },
          { key: "createdAt", header: "Signed in", render: s => <span className="nowrap">{formatDateTime(s.createdAt)}</span> },
          { key: "lastUsedAt", header: "Last active", render: s => <span title={formatDateTime(s.lastUsedAt)}>{relativeTime(s.lastUsedAt)}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            render: s => (
              <Button size="sm" variant={s.current ? "default" : "ghost"} loading={busyId === s.id} onClick={() => void signOutDevice(s)}>
                {s.current ? "Sign out here" : "Sign out"}
              </Button>
            )
          }
        ]}
      />
    </Card>
  );
}
