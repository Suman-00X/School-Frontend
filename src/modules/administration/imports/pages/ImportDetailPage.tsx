import { useParams } from "react-router-dom";
import { Ban } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ButtonLink, Card, EmptyState, ErrorState, Page, PageHeader, SkeletonBlock, StatusBadge, Stepper } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useImport, type ImportStatus } from "../api/imports";
import { MappingStep } from "../components/MappingStep";
import { DoneStep, ImportingStep } from "../components/ImportProgress";
import "../imports.css";

const STEPS = ["Upload", "Match columns", "Import", "Done"];
const STEP_OF: Record<ImportStatus, number> = { MAPPING: 1, QUEUED: 2, PROCESSING: 2, COMPLETED: 3, FAILED: 3, CANCELLED: 3 };

/* AD-02: one import, from column matching to its result */
export default function ImportDetailPage() {
  const { importId } = useParams();
  const { can } = useAuth();
  const job = useImport(importId);
  const data = job.data;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: "Imports", to: "/administration/imports" }, { label: data?.fileName ?? "Import" }]}
        title={
          <span className="row">
            {data?.fileName ?? "Import"} {data && <StatusBadge status={data.status} />}
          </span>
        }
        subtitle={data ? `Student import · uploaded ${formatDateTime(data.createdAt)}` : undefined}
      />
      {job.error ? (
        <ErrorState error={job.error} onRetry={() => void job.refetch()} />
      ) : !data ? (
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      ) : (
        <>
          <Stepper steps={STEPS} current={data.status === "COMPLETED" ? STEPS.length : STEP_OF[data.status]} />
          {data.status === "MAPPING" && (
            <MappingStep job={data} canEdit={can("administration.imports.create")} onStale={() => void job.refetch()} />
          )}
          {(data.status === "QUEUED" || data.status === "PROCESSING") && <ImportingStep job={data} />}
          {(data.status === "COMPLETED" || data.status === "FAILED") && <DoneStep job={data} />}
          {data.status === "CANCELLED" && (
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
