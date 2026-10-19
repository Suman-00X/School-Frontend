import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";

/* Admin › User Management: every kind of user, plus importing them. Each item is a list page;
   records (a student, an account) open full width with their own drill-in header. */
export function UserManagementLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          { items: [{ label: "All users", to: "/users", end: true, hidden: !can("users.accounts.read") }] },
          {
            label: "Users",
            items: [
              { label: "Students", to: "/users/students", hidden: !can("users.students.read") },
              { label: "Parents", to: "/users/parents", hidden: !can("users.parents.read") },
              { label: "Teachers", to: "/users/teachers", hidden: !can("users.teachers.read") },
              { label: "Staff", to: "/users/staff", hidden: !can("users.staff.read") }
            ]
          },
          {
            label: "Tools",
            items: [
              { label: "Import", to: "/administration/imports", hidden: !can("administration.imports.read") },
              { label: "Activity", to: "/users/activity", hidden: !can("users.activity.read") }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
