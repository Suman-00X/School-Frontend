import type { Account } from "@/common/api";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Card, DescriptionList, Skeleton, StatusBadge } from "@/common/ui";
import { enumLabel, formatDate, formatDateTime } from "@/common/utils/format";
import type { Student } from "../api/students";
import { useReportCards } from "../api/records";

export function OverviewTab({ student: s }: { student: Student }) {
  const { can } = useAuth();
  const account = useApiGet<Account>(can("users.accounts.read") ? `/users/${s.userId}` : null);
  /* No per-student enrollment endpoint (gap); the report-card read carries the section and roll number */
  const cards = useReportCards(s.id, can("academics.reportCards.read"));
  const a = account.data;
  const placement = cards.data?.student;

  return (
    <div className="grid-2">
      <Card title="Profile">
        <DescriptionList
          items={[
            { label: "Admission number", value: s.admissionNumber },
            { label: "Admission date", value: formatDate(s.admissionDate) },
            { label: "Blood group", value: s.bloodGroup },
            { label: "Category", value: s.category },
            { label: "Religion", value: s.religion },
            { label: "Notes", value: s.description, wide: true }
          ]}
        />
      </Card>
      <Card title="Enrollment" subtitle="This academic year">
        {cards.isLoading || placement ? (
          /* The skeleton is the same list, so the card keeps its size when the data arrives */
          <DescriptionList
            items={[
              { label: "Section", value: placement ? placement.section.name : <Skeleton width="60%" /> },
              { label: "Roll number", value: placement ? <span className="mono">{placement.rollNumber}</span> : <Skeleton width="40%" /> }
            ]}
          />
        ) : (
          <div className="small muted">
            {isApiError(cards.error) && cards.error.status === 404
              ? "Not enrolled in this academic year."
              : "The current class and section can't be shown here yet: the API has no enrollment read per student."}
          </div>
        )}
      </Card>
      {can("users.accounts.read") && (
        <Card title="Account" className="span-2">
          {account.isLoading || a ? (
            <DescriptionList
              columns={3}
              items={[
                { label: "Status", value: a ? <StatusBadge status={a.status} /> : <Skeleton width="50%" /> },
                { label: "Gender", value: a ? enumLabel(a.gender) : <Skeleton width="50%" /> },
                { label: "Date of birth", value: a ? formatDate(a.dob) : <Skeleton width="50%" /> },
                { label: "Last sign-in", value: a ? (a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never") : <Skeleton width="60%" /> },
                { label: "Password set", value: a ? (a.passwordChangedAt ? formatDateTime(a.passwordChangedAt) : "Not yet (send an invitation)") : <Skeleton width="60%" /> },
                { label: "Address", value: a ? a.address : <Skeleton width="70%" /> }
              ]}
            />
          ) : (
            <div className="small muted">Account details aren't available.</div>
          )}
        </Card>
      )}
    </div>
  );
}
