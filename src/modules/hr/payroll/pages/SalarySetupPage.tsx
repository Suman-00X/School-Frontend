/* HR-02 · Salary setup: salary components, and each employee's salary (revisions) */
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { Page, Tabs, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { ComponentsPanel } from "../components/ComponentsPanel";
import { EmployeeSalariesPanel } from "../components/EmployeeSalariesPanel";

const SALARY_TABS = { components: "/hr/salary-components", salaries: "/hr/employee-salaries" } as const;

export default function SalarySetupPage({ view }: { view: keyof typeof SALARY_TABS }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const tabs: TabItem[] = [
    { id: "salaries", label: "Employee salaries", hidden: !can("hr.employeeSalaries.read") },
    { id: "components", label: "Components", hidden: !can("hr.salaryComponents.read") }
  ];

  return (
    <Page>
      <PageIntro>
        {view === "components"
          ? "Earnings and deductions that salaries are built from: a fixed amount or a percent of basic."
          : "Each employee's monthly basic and components. To change pay, add a revision from a month; old ones stay as history."}
      </PageIntro>
      <Tabs tabs={tabs} value={view} onChange={id => navigate(SALARY_TABS[id as keyof typeof SALARY_TABS], { replace: true })} />
      {view === "components" ? <ComponentsPanel /> : <EmployeeSalariesPanel />}
    </Page>
  );
}
