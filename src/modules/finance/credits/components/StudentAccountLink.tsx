import { Wallet } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ButtonLink } from "@/common/ui";
import { OPS_PATHS } from "../../shared/utils/opsPaths";

/* For the student profile (People): a button to the student's finance account (FI-11).
   Renders nothing for someone who can't read invoices. */
export function StudentAccountLink({ studentId, label = "Fee account", size }: { studentId: string; label?: string; size?: "sm" | "md" }) {
  const { can } = useAuth();
  if (!can("finance.invoices.read") || !studentId) return null;
  return (
    <ButtonLink to={OPS_PATHS.student(studentId)} icon={<Wallet />} size={size}>
      {label}
    </ButtonLink>
  );
}
