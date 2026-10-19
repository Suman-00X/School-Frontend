import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { api, errorMessage, isApiError, type Query } from "@/common/api";
import { Button, Card, FooterStatus, RadioGroup } from "@/common/ui";
import "./exports.css";

export type ExportFormat = "xlsx" | "csv";

/* Download one export: the file is fetched with the token and saved under the server's name.
   Field errors (VALIDATION_ERROR) come back per field; anything else is the card's message. */
export function useExportDownload(path: string, fallbackName: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const run = async (query: Query) => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.download(path, query, fallbackName);
    } catch (e) {
      if (isApiError(e) && e.isValidation && e.details.length) {
        setFieldErrors(e.fieldErrors());
        setError("Check the highlighted fields.");
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const clear = (field?: string) => {
    setError(null);
    if (field) setFieldErrors(f => ({ ...f, [field]: "" }));
  };
  return { run, busy, error, fieldErrors, clear };
}

/* One export: what the file holds, its own small form, the format and a Download button.
   The message line under the form is always there, so an error never moves the card. */
export function ExportCard({
  title,
  icon,
  contents,
  children,
  format,
  onFormat,
  onDownload,
  busy,
  error,
  disabled
}: {
  title: string;
  icon: ReactNode;
  contents: string;
  children?: ReactNode;
  format: ExportFormat;
  onFormat: (f: ExportFormat) => void;
  onDownload: () => void;
  busy: boolean;
  error: string | null;
  disabled?: boolean;
}) {
  return (
    <Card className="export-card">
      <div className="export-card-inner">
        <div className="export-head">
          <span className="export-icon" aria-hidden="true">
            {icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 className="export-title">{title}</h2>
            <p className="small muted">{contents}</p>
          </div>
        </div>
        <div className="export-fields">{children}</div>
        <div className="export-foot">
          <RadioGroup
            aria-label={`${title} file format`}
            value={format}
            onChange={onFormat}
            options={[
              { value: "xlsx", label: "Excel" },
              { value: "csv", label: "CSV" }
            ]}
          />
          <Button variant="primary" icon={<Download />} loading={busy} disabled={disabled} onClick={onDownload}>
            Download
          </Button>
        </div>
        <FooterStatus>{error}</FooterStatus>
      </div>
    </Card>
  );
}
