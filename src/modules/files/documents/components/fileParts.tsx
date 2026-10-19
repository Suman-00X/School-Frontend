import { useMemo } from "react";
import { FileImage, FileSpreadsheet, FileText, File as FileIconGeneric } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useToast } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { studentName, useStudentOptions } from "@/modules/users";
import { useEmployees } from "@/modules/administration";
import { downloadUrl, kindOf, useStaffRecords, type StoredFile } from "../api/documents";

export function FileTypeIcon({ contentType }: { contentType: string }) {
  const kind = kindOf(contentType);
  const Icon = kind === "Image" ? FileImage : kind === "Excel" || kind === "CSV" ? FileSpreadsheet : kind === "File" ? FileIconGeneric : FileText;
  return <Icon size={16} className="muted" aria-label={kind} />;
}

/* Names for owners and uploaders. Rows carry only ids (gap): students and staff come from the
   lists the person may read, uploaders from the employee lists ("You" for the viewer). */
export function useFileNames() {
  const { me } = useAuth();
  const students = useStudentOptions();
  const staff = useStaffRecords();
  const { people } = useEmployees();
  const uploaders = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people]);
  return {
    owner: (f: Pick<StoredFile, "ownerType" | "ownerId">): string | null => {
      if (f.ownerType === "GENERAL") return "Whole school";
      if (f.ownerType === "STUDENT") {
        const s = students.byId.get(f.ownerId);
        return s ? `${studentName(s)} · ${s.admissionNumber}` : null;
      }
      const s = staff.byId.get(f.ownerId);
      return s ? fullName(s.user) : null;
    },
    ownerLink: (f: Pick<StoredFile, "ownerType" | "ownerId">): string | null =>
      f.ownerType === "STUDENT" && students.allowed ? `/users/students/${f.ownerId}?tab=documents` : f.ownerType === "STAFF" && staff.allowed ? `/users/staff/${f.ownerId}` : null,
    uploader: (userId: string | null): string | null => (!userId ? null : userId === me?.account.id ? "You" : (uploaders.get(userId) ?? null))
  };
}

/* Open the signed link in a new tab. The tab opens before the request so pop-up blockers let it
   through; the link expires after 15 minutes, so it is fetched on every click. */
export function useDownload() {
  const toast = useToast();
  return async (f: StoredFile) => {
    const tab = window.open("", "_blank");
    try {
      const res = await downloadUrl(f.id);
      if (tab) {
        tab.opener = null;
        tab.location.href = res.data.url;
      } else window.location.assign(res.data.url);
    } catch (e) {
      tab?.close();
      toast.error(e);
    }
  };
}
