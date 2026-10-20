/* Subject codes (Academics › Setup › Policy): each class's stage and position, the middle digits
   of its subject codes (MA221). ADMIN and PRINCIPAL edit; everyone else reads the same table. */
import { useMemo, useState } from "react";
import { Lock, RotateCcw, Save } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Alert, Badge, Button, Card, ErrorState, Page, PageHeader, Select, Skeleton, useConfirm, useToast } from "@/common/ui";
import { CLASS_SUBJECTS_PATH } from "../../class-subjects/api/classSubjects";
import { SECTION_SUBJECTS_PATH } from "../../section-subjects/api/sectionSubjects";
import { placeLabel, saveCodeSlots, SLOT_DIGITS, SUBJECT_CODE_SLOTS_PATH, type CodeSlot } from "../api/subjectCodes";
import "../../shared/components/setup.css";
import "../components/subjectCodes.css";

type Place = { stage: number | null; position: number | null };
/* Unsaved places by class id */
type Draft = Record<string, Place>;

const DIGIT_OPTIONS = SLOT_DIGITS.map(n => ({ value: String(n), label: String(n) }));
const placeKey = (p: Place) => (p.stage && p.position ? `${p.stage}-${p.position}` : null);
const same = (a: Place, b: Place) => a.stage === b.stage && a.position === b.position;

export default function SubjectCodesPage() {
  const { can } = useAuth();
  const canEdit = can("academics.subjectCodes.manage");
  const slots = useApiGet<CodeSlot[]>(SUBJECT_CODE_SLOTS_PATH);
  const rows = useMemo(() => slots.data ?? [], [slots.data]);

  return (
    <Page>
      <PageHeader
        title="Subject codes"
        subtitle={
          canEdit
            ? "Where each class sits in the code of every subject it is taught"
            : "Where each class sits in the code of every subject it is taught. Only an administrator or the principal can change this."
        }
      />
      {slots.error ? (
        <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
      ) : (
        <div className="subject-codes-layout">
          <PlacesCard rows={rows} loading={slots.isLoading} canEdit={canEdit} />
          <AnatomyCard rows={rows} />
        </div>
      )}
    </Page>
  );
}

function PlacesCard({ rows, loading, canEdit }: { rows: CodeSlot[]; loading: boolean; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const save = useApiMutation(saveCodeSlots, { invalidate: [SUBJECT_CODE_SLOTS_PATH, CLASS_SUBJECTS_PATH, SECTION_SUBJECTS_PATH] });
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);

  const placeOf = (r: CodeSlot): Place => draft[r.classId] ?? { stage: r.stage, position: r.position };
  const changed = rows.filter(r => !same(placeOf(r), r));

  /* Classes sharing a place: each row names the others */
  const sharers = useMemo(() => {
    const byPlace = new Map<string, string[]>();
    for (const r of rows) {
      const key = placeKey(draft[r.classId] ?? r);
      if (key) byPlace.set(key, [...(byPlace.get(key) ?? []), r.className]);
    }
    return byPlace;
  }, [rows, draft]);
  const clashOf = (r: CodeSlot) => {
    const key = placeKey(placeOf(r));
    const names = key ? (sharers.get(key) ?? []).filter(n => n !== r.className) : [];
    return names.length ? `Also ${names.join(", ")}'s place` : null;
  };
  const incomplete = changed.some(r => !placeKey(placeOf(r)));
  const clashing = rows.some(r => clashOf(r));

  const set = (r: CodeSlot, field: keyof Place, value: string) =>
    setDraft(d => ({ ...d, [r.classId]: { ...placeOf(r), [field]: value ? Number(value) : null } }));

  /* Unlocked classes go back to their level's default place, when no other class keeps it */
  const useDefaults = () => {
    const next: Draft = { ...draft };
    const held = new Set(rows.filter(r => r.locked || !r.defaultStage).map(r => placeKey(next[r.classId] ?? r)).filter(Boolean));
    for (const r of rows) {
      if (r.locked || !r.defaultStage || !r.defaultPosition) continue;
      const fallback = { stage: r.defaultStage, position: r.defaultPosition };
      if (!held.has(placeKey(fallback))) next[r.classId] = fallback;
    }
    setDraft(next);
  };
  const offDefault = rows.some(r => !r.locked && r.defaultStage && !same(placeOf(r), { stage: r.defaultStage, position: r.defaultPosition }));

  const submit = async () => {
    setError(null);
    if (!changed.length || incomplete || clashing) return;
    const ok = await confirm({
      title: `Move ${changed.length === 1 ? changed[0].className : `${changed.length} classes`}?`,
      message: `${changed.map(r => `${r.className}: ${placeLabel(r.stage, r.position)} → ${placeLabel(placeOf(r).stage, placeOf(r).position)}`).join(" · ")}. Their subject codes and their sections' codes are renewed in every year that has them.`,
      confirmLabel: "Save places",
      tone: "primary"
    });
    if (!ok) return;
    save.mutate(
      changed.map(r => ({ classId: r.classId, stage: placeOf(r).stage!, position: placeOf(r).position! })),
      {
        onSuccess: res => {
          toast.success(res.message);
          setDraft({});
        },
        onError: err => setError(errorMessage(err))
      }
    );
  };

  return (
    <Card
      title="Places"
      subtitle="Stage and position of each class: the two middle digits of its codes"
      flush
      actions={
        canEdit && (
          <Button icon={<RotateCcw />} onClick={useDefaults} disabled={!offDefault || save.isPending}>
            Use default places
          </Button>
        )
      }
      footer={
        canEdit && (
          <div className="subject-codes-footer">
            <span className={error ? "small danger-text" : "small muted"}>
              {error ??
                (clashing
                  ? "Two classes cannot share a place."
                  : changed.length
                    ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}`
                    : "Classes marked In use keep their place: their codes are on exam papers or assessments.")}
            </span>
            <div className="row">
              <Button onClick={() => setDraft({})} disabled={!changed.length || save.isPending}>
                Discard
              </Button>
              <Button variant="primary" icon={<Save />} loading={save.isPending} disabled={!changed.length || incomplete || clashing} onClick={() => void submit()}>
                Save places
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="table-wrap">
        <table className="table subject-codes-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Stage</th>
              <th>Position</th>
              <th>Code digits</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <Skeleton height={14} />
                    </td>
                  </tr>
                ))
              : rows.map(r => {
                  const p = placeOf(r);
                  const clash = clashOf(r);
                  const editable = canEdit && !r.locked;
                  return (
                    <tr key={r.classId} className={same(p, r) ? undefined : "is-changed"}>
                      <td>
                        <strong style={{ fontWeight: 550 }}>{r.className}</strong>
                        {clash && <div className="small danger-text">{clash}</div>}
                      </td>
                      <td className="subject-codes-digit">
                        {editable ? (
                          <Select aria-label={`${r.className} stage`} options={DIGIT_OPTIONS} value={p.stage ? String(p.stage) : ""} placeholder="–" disabled={save.isPending} onChange={e => set(r, "stage", e.target.value)} />
                        ) : (
                          <span className="mono">{p.stage ?? "–"}</span>
                        )}
                      </td>
                      <td className="subject-codes-digit">
                        {editable ? (
                          <Select aria-label={`${r.className} position`} options={DIGIT_OPTIONS} value={p.position ? String(p.position) : ""} placeholder="–" disabled={save.isPending} onChange={e => set(r, "position", e.target.value)} />
                        ) : (
                          <span className="mono">{p.position ?? "–"}</span>
                        )}
                      </td>
                      <td>
                        {placeKey(p) ? (
                          <span className="mono" title="Required / optional">
                            {p.stage}
                            {p.position}1 <span className="muted">/ {p.stage}
                            {p.position}0</span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="subject-codes-status">
                        {r.locked ? (
                          <Badge tone="warning">
                            <Lock size={12} /> In use
                          </Badge>
                        ) : !r.stage ? (
                          <Badge tone="danger">No place</Badge>
                        ) : r.defaultStage && !same(p, { stage: r.defaultStage, position: r.defaultPosition }) ? (
                          <span className="small muted">Default {placeLabel(r.defaultStage, r.defaultPosition)}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!loading && rows.some(r => !r.stage) && (
        <div className="subject-codes-note">
          <Alert tone="warning">A class with no place can't be given subjects until it has one: its level's usual place is taken by another class.</Alert>
        </div>
      )}
    </Card>
  );
}

/* How a code is built, with this school's stages */
function AnatomyCard({ rows }: { rows: CodeSlot[] }) {
  const sample = rows.find(r => r.stage && r.position && r.level === "GRADE_2") ?? rows.find(r => r.stage && r.position);
  const stage = sample?.stage ?? 2;
  const position = sample?.position ?? 2;
  const stages = useMemo(() => {
    const byStage = new Map<number, CodeSlot[]>();
    for (const r of rows) if (r.stage) byStage.set(r.stage, [...(byStage.get(r.stage) ?? []), r]);
    return [...byStage].sort(([a], [b]) => a - b).map(([n, list]) => [n, list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))] as const);
  }, [rows]);

  return (
    <Card title="How a code is made" subtitle="The same every year; each section adds its letter">
      <div className="stack">
        <div className="code-anatomy" aria-label={`MA${stage}${position}1`}>
          <span className="code-part">
            <span className="mono">MA</span>
            <span className="small muted">Subject</span>
          </span>
          <span className="code-part">
            <span className="mono">{stage}</span>
            <span className="small muted">Stage</span>
          </span>
          <span className="code-part">
            <span className="mono">{position}</span>
            <span className="small muted">Position</span>
          </span>
          <span className="code-part">
            <span className="mono">1</span>
            <span className="small muted">1 required · 0 optional</span>
          </span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Mathematics (MA) in {sample?.className ?? "Class 2"}: <span className="mono">MA{stage}{position}1</span> when required,{" "}
          <span className="mono">MA{stage}{position}0</span> when optional. Section A teaches it as <span className="mono">MA{stage}{position}1-A</span>.
        </p>
        {stages.length > 0 && (
          <ul className="code-stages">
            {stages.map(([n, list]) => (
              <li key={n}>
                <span className="code-stage-number mono">{n}</span>
                <span>{list.map(r => r.className).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
        <ul className="small muted enrollments-notes">
          <li>A class's place, or a subject's required/optional setting, can change only while no exam paper or assessment uses its codes.</li>
          <li>A subject's own code is letters only (MA, ENG); renaming it renames its codes, under the same condition.</li>
        </ul>
      </div>
    </Card>
  );
}
