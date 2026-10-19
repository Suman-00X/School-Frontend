import { useEffect, useState } from "react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, RadioGroup, TextInput, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { ANNOUNCEMENTS_PATH, publishAnnouncement, type Announcement } from "../api/announcements";

/* "2026-11-12T09:00" in the device's time, for a datetime-local input */
const localInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* Publish now, or schedule (a scheduled one can be rescheduled the same way) */
export function PublishDialog({ announcement, onClose, onDone }: { announcement: Announcement | null; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const publish = useApiMutation(publishAnnouncement, { invalidate: [ANNOUNCEMENTS_PATH, "/communication/activity"] });

  useEffect(() => {
    if (!announcement) return;
    const scheduled = announcement.status === "SCHEDULED" && announcement.publishAt;
    setMode(scheduled ? "later" : "now");
    setWhen(scheduled ? localInput(new Date(announcement.publishAt!)) : localInput(new Date(Date.now() + 60 * 60_000)));
    setError(null);
    setFieldError(undefined);
  }, [announcement]);

  if (!announcement) return null;

  const submit = () => {
    setError(null);
    setFieldError(undefined);
    let publishAt: string | undefined;
    if (mode === "later") {
      const d = new Date(when);
      if (!when || Number.isNaN(d.getTime())) return setFieldError("Pick a date and time");
      if (d.getTime() <= Date.now()) return setFieldError("Must be in the future");
      publishAt = d.toISOString();
    }
    publish.mutate(
      { id: announcement.id, publishAt },
      {
        onSuccess: res => {
          /* The API's scheduled message carries a raw UTC timestamp: say it in local time */
          toast.success(publishAt ? `“${announcement.title}” is scheduled for ${formatDateTime(publishAt)}` : res.message);
          onDone?.();
          onClose();
        },
        onError: e => {
          if (isApiError(e) && e.isValidation) setFieldError(e.fieldErrors().publishAt ?? e.message);
          else setError(errorMessage(e));
        }
      }
    );
  };

  const rescheduling = announcement.status === "SCHEDULED";
  return (
    <Dialog
      open
      onClose={onClose}
      title={rescheduling ? `Publish or reschedule “${announcement.title}”` : `Publish “${announcement.title}”`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={publish.isPending} onClick={submit}>
            {mode === "now" ? "Publish now" : rescheduling ? "Reschedule" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <RadioGroup
          value={mode}
          onChange={setMode}
          options={[
            { value: "now", label: "Publish now", description: "Everyone in the audience gets it within a minute." },
            { value: "later", label: "Schedule", description: "It goes out at the time you pick. You can still edit it until then." }
          ]}
        />
        {/* Always shown, so choosing a mode doesn't move the dialog */}
        <TextInput
          label="Send at"
          type="datetime-local"
          value={when}
          min={localInput(new Date())}
          disabled={mode !== "later"}
          onChange={e => {
            setWhen(e.target.value);
            setFieldError(undefined);
          }}
          hint={mode === "later" ? "Your device's time" : "Pick Schedule to choose a time"}
          error={fieldError}
        />
      </div>
    </Dialog>
  );
}
