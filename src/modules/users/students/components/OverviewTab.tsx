import type { Account } from "@/common/api";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Card, DescriptionList, SkeletonBlock, StatusBadge } from "@/common/ui";
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
        {cards.isLoading ? (
          <SkeletonBlock lines={2} />
        ) : placement ? (
          <DescriptionList
            items={[
              { label: "Section", value: placement.section.name },
              { label: "Roll number", value: <span className="mono">{placement.rollNumber}</span> }
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
          {account.isLoading ? (
            <SkeletonBlock lines={3} />
          ) : a ? (
            <DescriptionList
              columns={3}
              items={[
                { label: "Status", value: <StatusBadge status={a.status} /> },
                { label: "Gender", value: enumLabel(a.gender) },
                { label: "Date of birth", value: formatDate(a.dob) },
                { label: "Last sign-in", value: a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never" },
                { label: "Password set", value: a.passwordChangedAt ? formatDateTime(a.passwordChangedAt) : "Not yet (send an invitation)" },
                { label: "Address", value: a.address }
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
