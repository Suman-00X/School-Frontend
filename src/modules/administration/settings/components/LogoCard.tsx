import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { errorMessage } from "@/common/api";
import { Alert, Button, Card, FileDrop, useToast } from "@/common/ui";
import { useUploadLogo, type SchoolSettings } from "../api/settings";

const MAX_BYTES = 2 * 1024 * 1024;

export function LogoCard({ settings, canEdit, onExpired }: { settings: SchoolSettings; canEdit: boolean; onExpired: () => void }) {
  const toast = useToast();
  const upload = useUploadLogo();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  /* The signed link lasts an hour: re-fetch once when it stops loading */
  const retried = useRef<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = () => {
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onSuccess: res => {
        toast.success(res.message);
        setFile(null);
      },
      onError: e => setError(errorMessage(e))
    });
  };

  const shown = preview ?? settings.logoUrl;

  return (
    <Card title="Logo" subtitle="Shown on report cards and fee receipts">
      <div className="stack">
        <div
          style={{
            height: 140,
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-hover)"
          }}
        >
          {shown ? (
            <img
              src={shown}
              alt={`${settings.name} logo`}
              style={{ maxHeight: 120, maxWidth: "90%", objectFit: "contain" }}
              onError={() => {
                if (!preview && retried.current !== settings.logoUrl) {
                  retried.current = settings.logoUrl;
                  onExpired();
                }
              }}
            />
          ) : (
            <div className="muted stack-sm" style={{ alignItems: "center" }}>
              <ImageIcon />
              <span className="small">No logo yet</span>
            </div>
          )}
        </div>
        {preview && <div className="small muted">Preview of the new logo. It replaces the current one when you upload it.</div>}

        {canEdit && (
          <>
            <FileDrop
              accept="image/png,image/jpeg,image/webp"
              maxBytes={MAX_BYTES}
              file={file}
              onFile={f => {
                setError(null);
                setFile(f);
              }}
              onReject={setError}
              hint="PNG, JPEG or WebP, up to 2 MB"
            />
            {error && <Alert tone="danger">{error}</Alert>}
            {file && (
              <div className="form-actions">
                <Button onClick={() => setFile(null)} disabled={upload.isPending}>
                  Cancel
                </Button>
                <Button variant="primary" icon={<Upload />} loading={upload.isPending} onClick={save}>
                  {settings.logoUrl ? "Upload new logo" : "Upload logo"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
