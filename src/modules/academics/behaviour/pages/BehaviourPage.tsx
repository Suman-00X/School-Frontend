/* AC-18 · Behaviour: every remark written in students' log books this year, with filters.
   Teachers see their sections' remarks and the ones they wrote; any teacher can write one. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareWarning, Plus } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, Select, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { BEHAVIOUR_PATH, KIND_OF, REMARK_CATEGORIES, REMARK_KINDS, categoryLabel, type BehaviourRemark } from "../api/behaviour";
import { RemarkDrawer } from "../components/RemarkDrawer";

const ACK_OPTIONS = [
  { value: "true", label: "Waiting for a parent" },
  { value: "false", label: "Acknowledged" }
];

export default function BehaviourPage() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const { params, setParam, setPage } = useListParams({ sectionId: "", studentId: "", kind: "", category: "", from: "", to: "", unacknowledged: "" });
  const list = useApiList<BehaviourRemark>(BEHAVIOUR_PATH, params);
  const [open, setOpen] = useState<{ remark: BehaviourRemark | null } | null>(null);
  const filtered = Object.entries(params).some(([k, v]) => k !== "page" && k !== "limit" && v);

  const canRecord = can("academics.behaviourRemarks.record") && !readOnly;
  const sectionOptions = teaching.scoped ? sections.options.filter(o => teaching.teaches(o.value)) : sections.options;

  const columns: Column<BehaviourRemark>[] = [
    { key: "occurredOn", header: "Date", width: 110, render: r => <span className="nowrap">{formatDate(r.occurredOn)}</span> },
    {
      key: "student",
      header: "Student",
      render: r =>
        r.student ? (
          <div style={{ minWidth: 150 }}>
            <Link to={`/users/students/${r.studentId}?tab=behaviour`} onClick={e => e.stopPropagation()}>
              {r.student.user.firstName} {r.student.user.lastName}
            </Link>
            <div className="small muted">{r.student.admissionNumber}</div>
          </div>
        ) : (
          "—"
        )
    },
    {
      key: "section",
      header: "Section",
      render: r => {
        const s = sections.byId.get(r.sectionId);
        return <span className="nowrap">{s ? sectionTitle(s) : "—"}</span>;
      }
    },
    { key: "kind", header: "Kind", render: r => <Badge tone={KIND_OF[r.kind].tone}>{KIND_OF[r.kind].label}</Badge> },
    { key: "category", header: "About", render: r => <span className="nowrap">{categoryLabel(r.category)}</span> },
    {
      key: "remark",
      header: "Remark",
      render: r => (
        <span title={r.remark} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 220 }}>
          {r.remark}
        </span>
      )
    },
    { key: "recorder", header: "Written by", render: r => <span className="nowrap">{r.recorder ? `${r.recorder.firstName} ${r.recorder.lastName}` : "—"}</span> },
    {
      key: "ack",
      header: "Parent",
      render: r => (r.acknowledgedAt ? <Badge tone="success">Seen {formatDate(r.acknowledgedAt)}</Badge> : <Badge>Waiting</Badge>)
    }
  ];

  const newButton = canRecord && (
    <Button variant="primary" icon={<Plus />} onClick={() => setOpen({ remark: null })}>
      Write a remark
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>
        {teaching.scoped
          ? "Behaviour remarks in your sections and the ones you wrote. Students and parents read them in the app."
          : "Behaviour remarks written in students' log books this year. Students and parents read them in the app."}
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select label="Section" className="select-sm" value={params.sectionId} onChange={e => setParam("sectionId", e.target.value)} options={sectionOptions} placeholder="All sections" />
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="All students" />
          <Select label="Kind" className="select-sm" value={params.kind} onChange={e => setParam("kind", e.target.value)} options={REMARK_KINDS.map(k => ({ value: k.value, label: k.label }))} placeholder="Any kind" />
          <Select label="About" className="select-sm" value={params.category} onChange={e => setParam("category", e.target.value)} options={REMARK_CATEGORIES} placeholder="Any category" />
          <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
          <Select label="Parent" className="select-sm" value={params.unacknowledged} onChange={e => setParam("unacknowledged", e.target.value)} options={ACK_OPTIONS} placeholder="Seen or not" />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => setOpen({ remark: r })}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<MessageSquareWarning />} title="No remarks match" message="Try another section, student, kind or dates." />
            ) : (
              <EmptyState icon={<MessageSquareWarning />} title="No remarks yet" message="Appreciation, notes, concerns and incidents written about students show here." actions={newButton} />
            )
          }
        />
      </Card>
      <RemarkDrawer open={!!open} remark={open?.remark ?? null} onClose={() => setOpen(null)} />
    </Page>
  );
}
