import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage, isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Button, Dialog, FileDrop, Select, useToast } from "@/common/ui";
import { useUploadStudents } from "../api/imports";

const MAX_BYTES = 5 * 1024 * 1024;

export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { years, current } = useAcademicYear();
  const upload = useUploadStudents();
  const [file, setFile] = useState<File | null>(null);
  const [yearId, setYearId] = useState("");
  const [error, setError] = useState<{ message: string; noYear?: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
    setYearId(current?.id ?? "");
  }, [open, current?.id]);

  const submit = () => {
    if (!file) return setError({ message: "Choose a CSV file to import." });
    setError(null);
    upload.mutate(
      { file, academicYearId: yearId || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`/administration/imports/${res.data.id}`);
        },
        onError: e =>
          setError({ message: errorMessage(e), noYear: isApiError(e) && e.status === 422 && /academic year/i.test(e.message) })
      }
    );
  };

  const yearOptions = years
    .filter(y => !y.archivedAt)
    .map(y => ({ value: y.id, label: `${y.yearName}${y.isCurrent ? " (current)" : ""}` }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import students"
      /* Errors take the footer's status line, so the dialog never grows */
      footerStatus={
        error && (
          <>
            {error.message}
            {error.noYear && (
              <>
                {" "}
                <Link to="/academics/academic-years">Set up academic years</Link>
              </>
            )}
          </>
        )
      }
      footer={
        <>
          <Button onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={upload.isPending} disabled={!file}>
            Upload and match columns
          </Button>
        </>
      }
    >
      <div className="stack">
        {yearOptions.length > 0 && (
          <Select
            label="Admit into academic year"
            value={yearId}
            onChange={e => setYearId(e.target.value)}
            options={yearOptions}
            placeholder={current ? undefined : "The current year"}
            hint="Each row is enrolled in its class and section of this year."
          />
        )}
        <FileDrop
          accept=".csv,text/csv"
          maxBytes={MAX_BYTES}
          file={file}
          onFile={f => {
            setError(null);
            setFile(f);
          }}
          onReject={message => setError({ message })}
          hint="CSV, up to 5 MB and 5,000 rows"
        />
      </div>
    </Dialog>
  );
}
