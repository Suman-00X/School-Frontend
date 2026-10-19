import { CheckCircle2, UserPlus, UserRound } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { useStudentParents, type AdmissionResult } from "../../api/students";

/* After POST /users/students: the generated admission number, student code and roll number, then invite the student and the parents just linked */
export function AdmissionSuccess({ result, onAnother }: { result: AdmissionResult; onAnother: () => void }) {
  /* The admission response has parent ids only; their accounts come from the student's parent links */
  const links = useStudentParents(result.id, result.parents.length > 0);
  const name = fullName(result.user);
  const names: Record<string, string> = { [result.userId]: name };
  for (const l of links.rows ?? []) names[l.parent.user.id] = fullName(l.parent.user);
  const userIds = [result.userId, ...(links.rows ?? []).map(l => l.parent.user.id)];
  /* Counted from the admission itself, so the label (and the button's width) is right before the links load */
  const invitations = 1 + result.parents.length;

  return (
    <Card>
      <EmptyState
        icon={<CheckCircle2 />}
        title={`${name} admitted`}
        message={
          <>
            Admission no. <strong className="mono">{result.admissionNumber}</strong>, student code <strong className="mono">{result.studentCode}</strong>, roll no. <strong className="mono">{result.enrollment.rollNumber}</strong>
            {result.parents.length > 0 && `, ${result.parents.length} parent${result.parents.length === 1 ? "" : "s"} linked`}.
          </>
        }
        actions={
          <>
            <ButtonLink to={`/users/students/${result.id}`} variant="primary" icon={<UserRound />}>
              Open profile
            </ButtonLink>
            <InviteButton
              userIds={userIds}
              names={names}
              disabled={links.isLoading}
              label={invitations > 1 ? `Send ${invitations} invitations` : "Send invitation"}
            />
            <Button icon={<UserPlus />} onClick={onAnother}>
              Admit another
            </Button>
          </>
        }
      />
    </Card>
  );
}
