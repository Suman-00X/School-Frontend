import { useParams } from "react-router-dom";
import { Ban } from "lucide-react";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { ButtonLink, Card, EmptyState, ErrorState, Page, Skeleton, SkeletonBlock, StatusBadge, Stepper } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useImport, type ImportStatus } from "../api/imports";
import { MappingStep } from "../components/MappingStep";
import { DoneStep, ImportingStep } from "../components/ImportProgress";
import "../imports.css";

const STEPS = ["Upload", "Match columns", "Import", "Done"];
const STEP_OF: Record<ImportStatus, number> = { MAPPING: 1, QUEUED: 2, PROCESSING: 2, COMPLETED: 3, FAILED: 3, CANCELLED: 3 };

/* AD-02: one import, from column matching to its result. A drill-in page: back to the imports.
   The subtitle line and the Stepper are there from the first paint, so nothing moves when it loads. */
export default function ImportDetailPage() {
  const { importId } = useParams();
  const { can } = useAuth();
  const job = useImport(importId);
  const data = job.data;

  return (
    <Page>
      <DrillHeader
        back="/administration/imports"
        backLabel="Back to imports"
        title={
          <span className="row" style={{ flexWrap: "nowrap" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{data?.fileName ?? "Import"}</span>
            {data && <StatusBadge status={data.status} />}
          </span>
        }
      />
      {job.error ? (
        <ErrorState error={job.error} onRetry={() => void job.refetch()} />
      ) : (
        <>
          <div className="muted" style={{ minHeight: 21 }}>
            {data ? `Student import · uploaded ${formatDateTime(data.createdAt)}` : <Skeleton width={260} />}
          </div>
          <Stepper steps={STEPS} current={!data ? 1 : data.status === "COMPLETED" ? STEPS.length : STEP_OF[data.status]} />
          {!data && (
            <Card>
              <SkeletonBlock lines={8} />
            </Card>
          )}
          {data?.status === "MAPPING" && <MappingStep job={data} canEdit={can("administration.imports.create")} onStale={() => void job.refetch()} />}
          {(data?.status === "QUEUED" || data?.status === "PROCESSING") && <ImportingStep job={data} />}
          {(data?.status === "COMPLETED" || data?.status === "FAILED") && <DoneStep job={data} />}
          {data?.status === "CANCELLED" && (
            <EmptyState
              icon={<Ban />}
              title="This import was cancelled"
              message="Nothing was imported from this file."
              actions={<ButtonLink to="/administration/imports">Back to imports</ButtonLink>}
            />
          )}
        </>
      )}
    </Page>
  );
}
