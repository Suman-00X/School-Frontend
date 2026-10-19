import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { NoAccess, Page, Tabs } from "@/common/ui";
import { DASHBOARD_TABS } from "../api/dashboards";
import { AcademicsTab } from "../components/AcademicsTab";
import { AttendanceTab } from "../components/AttendanceTab";
import { FeesTab } from "../components/FeesTab";
import { OverviewTab } from "../components/OverviewTab";
import "../components/dashboards.css";

const PANELS = { overview: OverviewTab, attendance: AttendanceTab, fees: FeesTab, academics: AcademicsTab };

/* RP-01 · Dashboards: read-only figures for the year picked in the header. Each tab shows only
   when the person holds its key (an accountant sees Overview and Fees). */
export default function DashboardsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams();
  const visible = DASHBOARD_TABS.filter(t => can(t.permission));
  if (!visible.length) return <NoAccess />;
  const current = visible.find(t => t.id === tab);
  if (!current) return <Navigate to={`/reports/dashboards/${visible[0]!.id}`} replace />;
  const Panel = PANELS[current.id];
  return (
    <Page>
      {visible.length > 1 && (
        <Tabs tabs={visible.map(t => ({ id: t.id, label: t.label }))} value={current.id} onChange={id => navigate(`/reports/dashboards/${id}`)} />
      )}
      {/* A new tab starts with its own filters */}
      <Panel key={current.id} />
    </Page>
  );
}
