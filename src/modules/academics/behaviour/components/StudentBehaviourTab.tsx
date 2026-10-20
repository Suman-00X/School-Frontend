import { useState } from "react";
import { Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, Menu, MenuItem, Tabs, useConfirm, useToast } from "@/common/ui";
import { BEHAVIOUR_PATH, REMARK_KINDS, deleteRemark, useBehaviourSummary, type BehaviourRemark } from "../api/behaviour";
import { BehaviourKpis, BehaviourLog, NoRemarks } from "./BehaviourLog";
import { RemarkDrawer } from "./RemarkDrawer";

const KIND_TABS = [{ id: "", label: "All" }, ...REMARK_KINDS.map(k => ({ id: k.value, label: k.label }))];

/* PE-02 › Behaviour: the student's log book for the header's year, with the year's counts.
   Teachers see the entries from the sections they teach and their own. */
export function StudentBehaviourTab({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ remark: BehaviourRemark | null } | null>(null);
  const summary = useBehaviourSummary(studentId);
  const list = useApiList<BehaviourRemark>(BEHAVIOUR_PATH, { studentId, kind: kind || undefined, page, limit: 20 });
  const remove = useApiMutation(deleteRemark, { invalidate: [BEHAVIOUR_PATH] });
  const canRecord = can("academics.behaviourRemarks.record") && !readOnly;

  const addButton = canRecord && (
    <Button variant="primary" icon={<Plus />} onClick={() => setOpen({ remark: null })}>
      Write a remark
    </Button>
  );

  const removeRemark = async (r: BehaviourRemark) => {
    const ok = await confirm({ title: "Remove this remark?", message: "It disappears from the log book for the student, the parents and the teachers.", confirmLabel: "Remove" });
    if (ok) remove.mutate(r.id, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  const error = list.error ?? summary.error;
  if (error)
    return isApiError(error) && error.status === 403 ? (
      <EmptyState icon={<Lock />} title="You can't see this student's behaviour log" message={error.message} />
    ) : (
      <ErrorState error={error} onRetry={() => void list.refetch()} />
    );

  return (
    <div className="stack">
      <BehaviourKpis summary={summary.data} loading={summary.isLoading} />
      <Card flush title="Log book" actions={addButton}>
        <div style={{ padding: "0 14px" }}>
          <Tabs
            tabs={KIND_TABS}
            value={kind}
            onChange={id => {
              setKind(id);
              setPage(1);
            }}
          />
        </div>
        <div style={{ padding: 14 }}>
          <BehaviourLog
            rows={list.rows}
            loading={list.isLoading}
            meta={list.meta}
            onPageChange={setPage}
            empty={<NoRemarks message={kind ? "No remarks of this kind this year." : "Appreciation, notes and concerns written about the student this year show here."} actions={!kind && addButton} />}
            actions={r =>
              r.canEdit && !readOnly ? (
                <Menu trigger={toggle => <Button variant="ghost" size="sm" icon={<MoreHorizontal />} aria-label="Remark actions" onClick={toggle} />}>
                  {close => (
                    <>
                      <MenuItem
                        icon={<Pencil />}
                        onClick={() => {
                          close();
                          setOpen({ remark: r });
                        }}
                      >
                        Edit
                      </MenuItem>
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        onClick={() => {
                          close();
                          void removeRemark(r);
                        }}
                      >
                        Remove
                      </MenuItem>
                    </>
                  )}
                </Menu>
              ) : null
            }
          />
        </div>
      </Card>
      <RemarkDrawer open={!!open} remark={open?.remark ?? null} studentId={studentId} fixedName={studentName} onClose={() => setOpen(null)} />
    </div>
  );
}
