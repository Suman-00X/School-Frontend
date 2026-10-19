import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, ErrorState, SkeletonBlock } from "@/common/ui";
import { formatBytes, formatDateTime } from "@/common/utils/format";
import { FILE_RULES, FILES_PATH, kindOf, OWNER_LABELS, type StoredFile } from "../api/documents";
import { useDownload, useFileNames } from "./fileParts";

/* One file's details (GET /files/:fileId adds the checksum), with Download and Delete */
export function FileDrawer({ id, onClose, onDelete }: { id: string; onClose: () => void; onDelete: (f: StoredFile) => void }) {
  const { can } = useAuth();
  const q = useApiGet<StoredFile>(`${FILES_PATH}/${id}`);
  const names = useFileNames();
  const download = useDownload();
  const [busy, setBusy] = useState(false);
  const f = q.data;

  const owner = f && names.owner(f);
  const link = f && names.ownerLink(f);

  return (
    <Drawer
      open
      onClose={onClose}
      title={f?.fileName ?? "Document"}
      subtitle={f && <Badge>{FILE_RULES[f.category]?.label ?? f.category}</Badge>}
      footer={
        f && (
          <>
            {can("files.documents.remove") && (
              <Button variant="ghost" className="file-delete" onClick={() => onDelete(f)}>
                Delete
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Download />}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await download(f);
                setBusy(false);
              }}
            >
              Download
            </Button>
          </>
        )
      }
    >
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !f ? (
        <SkeletonBlock lines={8} />
      ) : (
        <DescriptionList
          columns={1}
          items={[
            { label: "Belongs to", value: OWNER_LABELS[f.ownerType].one },
            {
              label: f.ownerType === "STUDENT" ? "Student" : "Staff member",
              value: link ? <Link to={link}>{owner ?? "Open the record"}</Link> : owner,
              hidden: f.ownerType === "GENERAL"
            },
            { label: "Description", value: f.description },
            { label: "Type", value: `${kindOf(f.contentType)} (${f.contentType})` },
            { label: "Size", value: formatBytes(f.size) },
            { label: "Uploaded", value: formatDateTime(f.createdAt) },
            { label: "Uploaded by", value: names.uploader(f.uploadedBy), hidden: !names.uploader(f.uploadedBy) },
            {
              label: "Checksum (SHA-256)",
              value: f.checksum && (
                <span className="mono small file-checksum" title={f.checksum}>
                  {f.checksum}
                </span>
              ),
              hidden: !f.checksum
            }
          ]}
        />
      )}
    </Drawer>
  );
}
