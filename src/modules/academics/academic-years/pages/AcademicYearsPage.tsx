import { useState, type ReactNode } from "react";
import { Archive, ArchiveRestore, CalendarCheck, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Menu, MenuItem, Page, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import {
  ACADEMIC_YEARS_PATH,
  archiveAcademicYear,
  offDaysLabel,
  restoreAcademicYear,
  updateAcademicYear,
  useAcademicYearMutation,
  type AcademicYearRecord
} from "../api/academicYears";
import { PageIntro } from "../../shared/components/PageIntro";
import { AcademicYearDrawer } from "../components/AcademicYearDrawer";

const MONTH_MS = 30 * 86_400_000;

/* Teachers keep last year's sections for a month after it stops being current */
const teacherAccessUntil = (y: AcademicYearRecord) => {
  if (!y.currentUntil || y.isCurrent) return null;
  const until = new Date(y.currentUntil).getTime() + MONTH_MS;
  return until > Date.now() ? new Date(until).toISOString() : null;
};

/* AC-01 */
export default function AcademicYearsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setPage } = useListParams({});
  const list = useApiList<AcademicYearRecord>(ACADEMIC_YEARS_PATH, { page: params.page, limit: params.limit });
  const [drawer, setDrawer] = useState<{ year: AcademicYearRecord | null } | null>(null);

  const canCreate = can("academics.academicYears.create");
  const canUpdate = can("academics.academicYears.update");
  const canArchive = can("academics.academicYears.archive");

  const makeCurrent = useAcademicYearMutation(updateAcademicYear, { everything: () => true });
  const archive = useAcademicYearMutation(archiveAcademicYear, { everything: () => true });
  const restore = useAcademicYearMutation(restoreAcademicYear, { everything: () => true });
  const handlers = { onSuccess: (res: { message: string }) => toast.success(res.message), onError: (e: unknown) => toast.error(e) };

  const current = list.rows?.find(y => y.isCurrent);

  const askMakeCurrent = async (y: AcademicYearRecord) => {
    const ok = await confirm({
      title: `Make ${y.yearName} the current year?`,
      message: current
        ? `${y.yearName} becomes the current year. ${current.yearName} stops being current. Teachers keep their ${current.yearName} sections for one month.`
        : `${y.yearName} becomes the current year, the default on every page.`,
      confirmLabel: "Make current",
      tone: "primary"
    });
    if (ok) makeCurrent.mutate({ id: y.id, isCurrent: true }, handlers);
  };

  const askArchive = async (y: AcademicYearRecord) => {
    const ok = await confirm({
      title: `Archive ${y.yearName}?`,
      message: `Attendance, marks, enrollments and the rest of ${y.yearName}'s academic records become read-only. Fees stay payable. You can unarchive it later.`,
      confirmLabel: "Archive year"
    });
    if (ok) archive.mutate(y.id, handlers);
  };

  const askRestore = async (y: AcademicYearRecord) => {
    const ok = await confirm({
      title: `Unarchive ${y.yearName}?`,
      message: `${y.yearName}'s academic records become editable again.`,
      confirmLabel: "Unarchive",
      tone: "primary"
    });
    if (ok) restore.mutate(y.id, handlers);
  };

  const rowActions = (y: AcademicYearRecord) => {
    const items = [
      canUpdate && !y.archivedAt && { label: "Edit", icon: <Pencil />, run: () => setDrawer({ year: y }) },
      canUpdate && !y.isCurrent && !y.archivedAt && { label: "Make current", icon: <CalendarCheck />, run: () => void askMakeCurrent(y) },
      canArchive && !y.archivedAt && !y.isCurrent && { label: "Archive", icon: <Archive />, run: () => void askArchive(y), danger: true },
      canArchive && y.archivedAt && { label: "Unarchive", icon: <ArchiveRestore />, run: () => void askRestore(y) }
    ].filter(Boolean) as { label: string; icon: ReactNode; run: () => void; danger?: boolean }[];
    if (!items.length) return null;
    return (
      <div onClick={e => e.stopPropagation()}>
        <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`Actions for ${y.yearName}`} />}>
          {close =>
            items.map(i => (
              <MenuItem
                key={i.label}
                icon={i.icon}
                danger={i.danger}
                onClick={() => {
                  close();
                  i.run();
                }}
              >
                {i.label}
              </MenuItem>
            ))
          }
        </Menu>
      </div>
    );
  };

  return (
    <Page>
      {/* The header tab already says "Academic years": no title */}
      <PageIntro
        actions={
          canCreate && (
            <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ year: null })}>
              New year
            </Button>
          )
        }
      >
        The school year's dates and weekly off days. Names come from the dates (2026-27). The current year is the default everywhere.
      </PageIntro>
      <Card flush>
        <DataTable
          rows={list.rows}
          rowKey={y => y.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={y => setDrawer({ year: y })}
          empty={
            <EmptyState
              title="No academic years yet"
              message="Create the school year first: sections, enrollments and admissions all belong to a year."
              actions={
                canCreate && (
                  <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ year: null })}>
                    New year
                  </Button>
                )
              }
            />
          }
          columns={[
            {
              key: "yearName",
              header: "Year",
              render: y => {
                const until = teacherAccessUntil(y);
                return (
                  <div className="row">
                    <strong>{y.yearName}</strong>
                    {y.isCurrent && <Badge tone="success">Current</Badge>}
                    {y.archivedAt && <Badge>Archived</Badge>}
                    {until && <Badge tone="info">Teacher access until {formatDate(until)}</Badge>}
                  </div>
                );
              }
            },
            {
              key: "dates",
              header: "Dates",
              render: y => (
                <span className="nowrap">
                  {formatDate(y.startDate)} – {formatDate(y.endDate)}
                </span>
              )
            },
            { key: "weeklyOffDays", header: "Weekly off", render: y => offDaysLabel(y.weeklyOffDays, y.offSaturdays) },
            { key: "description", header: "Description", render: y => <span className="muted">{y.description || "—"}</span> },
            { key: "actions", header: "", align: "right", width: 48, render: rowActions }
          ]}
        />
      </Card>
      <AcademicYearDrawer open={!!drawer} year={drawer?.year ?? null} canEdit={canUpdate} onClose={() => setDrawer(null)} />
    </Page>
  );
}
