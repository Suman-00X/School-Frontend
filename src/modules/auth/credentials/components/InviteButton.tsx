import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Button, DataTable, Dialog, useToast, type ButtonProps } from "@/common/ui";
import { sendInvitations, type InvitationResult } from "../api/invitations";

/* "Send invitation(s)" for one or many accounts (by user id). Shows the skipped ones with reasons.
   Hidden without auth.credentials.invite. `names` labels user ids in the skipped table. */
export function InviteButton({
  userIds,
  names = {},
  label,
  onDone,
  ...buttonProps
}: {
  userIds: string[];
  names?: Record<string, string>;
  label?: string;
  onDone?: (result: InvitationResult) => void;
} & Omit<ButtonProps, "onClick">) {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<InvitationResult["skipped"] | null>(null);
  if (!can("auth.credentials.invite")) return null;

  const run = async () => {
    setBusy(true);
    try {
      const res = await sendInvitations(userIds);
      const { invited, skipped: sk } = res.data;
      if (sk.length === 0) toast.success(res.message || `${invited.length} invitation(s) sent`);
      else {
        toast.show(
          <span>
            {invited.length} invitation(s) sent, {sk.length} skipped.{" "}
            <button className="btn-link btn" onClick={() => setSkipped(sk)}>
              View skipped
            </button>
          </span>,
          invited.length ? "warning" : "danger"
        );
        if (userIds.length === 1) setSkipped(sk);
      }
      onDone?.(res.data);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button icon={<Mail />} loading={busy} disabled={!userIds.length} onClick={() => void run()} {...buttonProps}>
        {label ?? (userIds.length > 1 ? `Send ${userIds.length} invitations` : "Send invitation")}
      </Button>
      <Dialog open={!!skipped} onClose={() => setSkipped(null)} title="Not invited" footer={<Button onClick={() => setSkipped(null)}>Close</Button>}>
        <DataTable
          rows={skipped ?? []}
          rowKey={s => s.userId}
          columns={[
            { key: "who", header: "Person", render: s => names[s.userId] ?? s.email ?? <span className="mono">{s.userId.slice(0, 8)}…</span> },
            { key: "reason", header: "Reason" }
          ]}
        />
      </Dialog>
    </>
  );
}
