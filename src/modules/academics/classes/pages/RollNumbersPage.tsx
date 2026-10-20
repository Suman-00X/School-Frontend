import { useState } from "react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Card, Page, PageHeader } from "@/common/ui";
import { RollNumberRuleCard } from "../components/RollNumberRuleCard";
import { RollNumbersDialog } from "../components/RollNumbersDialog";
import "../components/classes.css";
import "../../shared/components/setup.css";

/* AC-12 · Roll numbers (Academics › Setup › Calendar & rules): the school-wide order, and
   renumbering the header's year by it. Classes & sections renumbers one class or section. */
export default function RollNumbersPage() {
  const { selected: year } = useAcademicYear();
  const [rollAll, setRollAll] = useState(false);
  const yearName = year?.yearName ?? "the year";

  return (
    <Page>
      <PageHeader title="Roll numbers" subtitle="How students are numbered within each section, the same way across the school" />
      <div className="policy-layout">
        <RollNumberRuleCard onAssignAll={() => setRollAll(true)} />
        <Card title="How numbering works">
          <ul className="small muted enrollments-notes">
            <li>New admissions and transfers get the next number at the end of the section, until it is renumbered.</li>
            <li>Promoting a section numbers the new section by the rule.</li>
            <li>Students who left are numbered after the current ones.</li>
            <li>Changing the rule renumbers nobody: renumber a section or a class on Classes & sections, or the whole year here.</li>
          </ul>
        </Card>
      </div>
      {rollAll && <RollNumbersDialog target={{ all: true }} label={`all of ${yearName}`} onClose={() => setRollAll(false)} />}
    </Page>
  );
}
