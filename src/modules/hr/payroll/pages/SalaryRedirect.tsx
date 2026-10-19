import { Navigate } from "react-router-dom";
import { useAuth } from "@/common/auth";

/* /hr/salary (HR-02) opens the first tab the person may see */
export default function SalaryRedirect() {
  const { can } = useAuth();
  return <Navigate to={can("hr.employeeSalaries.read") ? "/hr/employee-salaries" : "/hr/salary-components"} replace />;
}
