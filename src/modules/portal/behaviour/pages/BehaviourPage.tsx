import { CheckCheck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, Page, PageHeader, Tabs, useToast } from "@/common/ui";
import { BehaviourKpis, BehaviourLog, NoRemarks, type BehaviourRemark } from "@/modules/academics";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { acknowledgeRemark, behaviourPath, useMyBehaviourSummary } from "../api/behaviour";

const TABS = [
  { id: "", label: "All" },
  { id: "true", label: "To acknowledge" }
];

/* PO-12 · Behaviour: the child's log book this year, newest first. A parent acknowledges each
   entry, like signing the school diary; the teachers see that it was read. */
export default function BehaviourPage() {
  const { student } = usePortalStudent();
  const { can } = useAuth();
  const toast = useToast();
  const { params, setParams, setPage } = useListParams({ unacknowledged: "" });
  const path = behaviourPath(student.id);
  const list = useApiList<BehaviourRemark>(path, { unacknowledged: params.unacknowledged || undefined, page: params.page, limit: params.limit });
  const summary = useMyBehaviourSummary(student.id);
  const ack = useApiMutation(acknowledgeRemark, { invalidate: [path] });
  const canAcknowledge = can("portal.behaviour.acknowledge");

  const error = list.error ?? summary.error;
  return (
    <Page>
      <PageHeader title="Behaviour" subtitle={studentFullName(student)} />
      {error ? (
        <PortalError error={error} onRetry={() => void list.refetch()} />
      ) : (
        <div className="stack">
          <BehaviourKpis summary={summary.data} loading={summary.isLoading} />
          <Card flush>
            {canAcknowledge && (
              <div style={{ padding: "0 14px" }}>
                <Tabs tabs={TABS} value={params.unacknowledged} onChange={id => setParams({ unacknowledged: id })} />
              </div>
            )}
            <div style={{ padding: 14 }}>
              <BehaviourLog
                rows={list.rows}
                loading={list.isLoading}
                meta={list.meta}
                onPageChange={setPage}
                empty={
                  <NoRemarks
                    message={
                      params.unacknowledged
                        ? "You have read and acknowledged every remark."
                        : "Appreciation and remarks from the teachers show here."
                    }
                  />
                }
                actions={r =>
                  canAcknowledge && !r.acknowledgedAt ? (
                    <Button
                      size="sm"
                      icon={<CheckCheck />}
                      loading={ack.isPending && ack.variables?.remarkId === r.id}
                      onClick={() =>
                        ack.mutate({ studentId: student.id, remarkId: r.id }, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) })
                      }
                    >
                      Acknowledge
                    </Button>
                  ) : null
                }
              />
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
