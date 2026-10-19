import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { formatBytes } from "@/common/utils/format";

/* Click or drop one file. Checks type and size on the client before anything is sent. */
export function FileDrop({
  accept,
  maxBytes,
  file,
  onFile,
  onReject,
  hint
}: {
  accept?: string;
  maxBytes?: number;
  file: File | null;
  onFile: (file: File | null) => void;
  onReject?: (message: string) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (f: File | undefined) => {
    if (!f) return;
    if (maxBytes && f.size > maxBytes) return onReject?.(`${f.name} is larger than ${formatBytes(maxBytes)}.`);
    if (accept) {
      const ok = accept.split(",").some(a => {
        const rule = a.trim().toLowerCase();
        if (rule.startsWith(".")) return f.name.toLowerCase().endsWith(rule);
        if (rule.endsWith("/*")) return f.type.startsWith(rule.slice(0, -1));
        return f.type === rule;
      });
      if (!ok) return onReject?.(`${f.name} is not an accepted file type.`);
    }
    onFile(f);
  };

  return (
    <div
      className={`dropzone${dragging ? " dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files[0]);
      }}
    >
      <input ref={input} type="file" hidden accept={accept} onChange={e => take(e.target.files?.[0] ?? undefined)} />
      <UploadCloud />
      {file ? (
        <>
          <div className="dropzone-line">
            <strong style={{ color: "var(--text)" }} title={file.name}>
              {file.name}
            </strong>{" "}
            · {formatBytes(file.size)}
          </div>
          <div className="dropzone-line small">Click to choose a different file</div>
        </>
      ) : (
        <>
          <div className="dropzone-line">
            <strong style={{ color: "var(--text)" }}>Click to choose a file</strong> or drag it here
          </div>
          {/* Always two lines, whatever was chosen */}
          <div className="dropzone-line small" title={hint}>
            {hint}
          </div>
        </>
      )}
    </div>
  );
}
