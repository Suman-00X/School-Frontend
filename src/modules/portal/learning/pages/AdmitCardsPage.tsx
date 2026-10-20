/* Admit cards: one per exam the school has issued, with its date sheet, to download and print */
import { useState } from "react";
import { Download, FileBadge } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, PageHeader, SkeletonBlock, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { admitCardsPath, downloadPortalAdmitCard, type PortalAdmitCard } from "../api/learning";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const COMPONENTS: Record<string, string> = { THEORY: "Theory", PRACTICAL: "Practical", INTERNAL: "Internal", PROJECT: "Project", ORAL: "Oral" };

export default function AdmitCardsPage() {
  const { student } = usePortalStudent();
  const cards = useApiGet<PortalAdmitCard[]>(admitCardsPath(student.id));
  const list = [...(cards.data ?? [])].sort((a, b) => (b.exam.startDate ?? "").localeCompare(a.exam.startDate ?? ""));

  return (
    <Page>
      <PageHeader title="Admit cards" subtitle={studentFullName(student)} />
      {cards.error ? (
        <PortalError error={cards.error} onRetry={() => void cards.refetch()} />
      ) : !cards.data ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileBadge />}
            title="No admit cards yet"
            message="The school issues an admit card before each exam to students who meet its attendance and fee rules."
          />
        </Card>
      ) : (
        <div className="stack">
          {list.map(card => (
            <AdmitCardItem key={card.id} card={card} studentId={student.id} />
          ))}
        </div>
      )}
    </Page>
  );
}

function AdmitCardItem({ card, studentId }: { card: PortalAdmitCard; studentId: string }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      await downloadPortalAdmitCard(studentId, card);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card
      flush
      title={card.exam.examName}
      subtitle={`${card.student.section} · Roll no. ${card.student.rollNumber ?? "—"} · issued ${formatDate(card.issuedAt)}`}
      actions={
        <Button icon={<Download />} loading={downloading} onClick={() => void download()}>
          Download
        </Button>
      }
    >
      <DataTable
        rows={card.papers}
        rowKey={p => p.displayCode}
        columns={[
          { key: "date", header: "Date", render: p => (p.examDate ? <span className="nowrap">{formatDate(p.examDate)}</span> : <span className="muted">To be announced</span>) },
          { key: "time", header: "Time", render: p => (p.startTime ? `${hhmm(p.startTime)}–${hhmm(p.endTime)}` : <span className="muted">—</span>) },
          { key: "subject", header: "Subject", render: p => (p.component ? `${p.subjectName} (${COMPONENTS[p.component] ?? p.component})` : p.subjectName) },
          { key: "room", header: "Room", render: p => p.room ?? <span className="muted">—</span> }
        ]}
      />
    </Card>
  );
}
