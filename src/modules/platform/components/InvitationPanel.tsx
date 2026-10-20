import { useState } from "react";
import { Check, Copy, MailCheck, MailWarning } from "lucide-react";
import { Alert, Button } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import type { Invitation } from "../api/schools";

/* The administrator's set-password link: emailed, and shown here to pass on by hand */
export function InvitationPanel({ invitation, email }: { invitation: Invitation; email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link stays selectable */
    }
  };

  return (
    <div className="stack-sm">
      {invitation.emailed ? (
        <Alert tone="success" title={<span className="inline-icon"><MailCheck size={15} /> Invitation emailed</span>}>
          {email} has been sent a link to set a password. It works once and expires on {formatDateTime(invitation.expiresAt)}.
        </Alert>
      ) : (
        <Alert tone="warning" title={<span className="inline-icon"><MailWarning size={15} /> The email could not be sent</span>}>
          Share this link with {email} yourself. It works once and expires on {formatDateTime(invitation.expiresAt)}.
        </Alert>
      )}
      <div className="invite-link">
        <input className="input mono" readOnly value={invitation.link} onFocus={e => e.currentTarget.select()} aria-label="Set-password link" />
        <Button icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
