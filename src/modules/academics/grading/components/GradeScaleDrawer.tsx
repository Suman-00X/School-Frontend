import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, Drawer, Field, Select, Switch, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import {
  bandProblem,
  createGradeScale,
  deleteGradeScale,
  GRADE_SCALES_PATH,
  updateGradeScale,
  useGradeScaleTemplates,
  type GradeScale,
  type GradeScaleInput
} from "../api/gradeScales";
import { BandsEditor, bandRow, CoverageBar, rowsOf, toBands, type BandRow } from "./BandsEditor";

type Values = { name: string; description: string; isDefault: boolean; rows: BandRow[]; templateKey: string };

const blankRows = () => [bandRow({ grade: "A", minPercent: 60, maxPercent: 100 }), bandRow({ grade: "B", minPercent: 33, maxPercent: 60 }), bandRow({ grade: "C", minPercent: 0, maxPercent: 33, isPassing: false })];

const sameBands = (a: BandRow[], b: BandRow[]) => JSON.stringify(toBands(a).sort((x, y) => x.minPercent - y.minPercent)) === JSON.stringify(toBands(b).sort((x, y) => x.minPercent - y.minPercent));

/* AC-06 grade scale editor: name, default, and the band rows with a live 0–100% bar.
   A new scale can start from a template; if its bands are kept as they are, only the
   template's key is sent. Read-only without manage. Mount it when opened. */
export function GradeScaleDrawer({ scale, canManage, onClose }: { scale: GradeScale | null; canManage: boolean; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const templates = useGradeScaleTemplates(!scale && canManage);
  const invalidate = [GRADE_SCALES_PATH, "/academics/result-policies"];
  const create = useApiMutation(createGradeScale, { invalidate });
  const update = useApiMutation(updateGradeScale, { invalidate });
  const remove = useApiMutation(deleteGradeScale, { invalidate });
  const initial: Values = scale
    ? { name: scale.name, description: scale.description ?? "", isDefault: scale.isDefault, rows: rowsOf(scale.bands), templateKey: "" }
    : { name: "", description: "", isDefault: false, rows: blankRows(), templateKey: "" };
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale?.id, scale?.updatedAt]);

  const template = templates.data?.find(t => t.key === values.templateKey);
  const editable = canManage;
  const problem = bandProblem(toBands(values.rows).filter(b => Number.isFinite(b.minPercent) && Number.isFinite(b.maxPercent)));
  /* Shown live once a save was tried; before that the rule is the hint */
  const bandsMessage = errors.bands ?? (tried ? problem : null);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues(x => ({ ...x, [k]: v }));
    setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const pickTemplate = (key: string) => {
    const t = templates.data?.find(x => x.key === key);
    setValues(v => ({
      ...v,
      templateKey: key,
      rows: t ? rowsOf(t.bands) : blankRows(),
      name: t && (!v.name.trim() || templates.data?.some(x => x.name === v.name)) ? t.name : v.name,
      description: t && (!v.description.trim() || templates.data?.some(x => x.description === v.description)) ? t.description : v.description
    }));
    setErrors({});
  };

  const body = (): GradeScaleInput | null => {
    const out: GradeScaleInput = {};
    const name = values.name.trim();
    const description = values.description.trim();
    if (!scale) {
      if (template && sameBands(values.rows, rowsOf(template.bands))) {
        out.templateKey = template.key;
        if (name && name !== template.name) out.name = name;
        if (description !== template.description) out.description = description;
      } else {
        out.name = name;
        out.bands = toBands(values.rows);
        if (description) out.description = description;
      }
      if (values.isDefault) out.isDefault = true;
      return out;
    }
    if (name !== scale.name) out.name = name;
    if (description !== (scale.description ?? "")) out.description = description;
    if (values.isDefault !== scale.isDefault) out.isDefault = values.isDefault;
    if (!sameBands(values.rows, rowsOf(scale.bands))) out.bands = toBands(values.rows);
    return Object.keys(out).length ? out : null;
  };

  const changes = scale ? body() : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFormError(null);
    const errs: Record<string, string> = {};
    const usesTemplate = !scale && template && sameBands(values.rows, rowsOf(template.bands));
    if (!values.name.trim() && !usesTemplate) errs.name = "Give the scale a name";
    if (problem) errs.bands = problem;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const b = body();
    if (!b) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.status === 422) setErrors({ bands: err.message });
      else if (isApiError(err) && err.status === 409) setErrors({ name: err.message });
      else if (isApiError(err) && err.isValidation) {
        const fe = err.fieldErrors();
        setErrors({ ...(fe.name ? { name: fe.name } : {}), ...(Object.keys(fe).some(k => k.startsWith("bands")) ? { bands: `Bands: ${Object.values(fe)[0]}` } : {}) });
        setFormError("Please correct the highlighted fields.");
      } else setFormError(errorMessage(err));
    };
    if (scale) update.mutate({ id: scale.id, ...b }, { onSuccess: done, onError });
    else create.mutate(b, { onSuccess: done, onError });
  };

  const askDelete = async () => {
    if (!scale) return;
    const ok = await confirm({
      title: `Delete ${scale.name}?`,
      message: `${scale.name} is removed. Exams and result policies that use it fall back to the school's default scale.${scale.isDefault ? " It is the default now, so pick another default afterwards." : ""}`,
      confirmLabel: "Delete scale"
    });
    if (ok)
      remove.mutate(scale.id, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => toast.error(err)
      });
  };

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={scale ? scale.name : "New grade scale"}
      subtitle={scale?.isDefault ? <Badge tone="success">School default</Badge> : scale ? "Grade scale" : "Bands from 0% to 100%, best grade at the top"}
      footerStatus={formError}
      footer={
        editable ? (
          <>
            {scale && (
              <Button variant="ghost" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="grade-scale-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!scale && !changes}>
              {scale ? "Save changes" : "Create scale"}
            </Button>
          </>
        ) : undefined
      }
    >
      <form id="grade-scale-form" className="stack" onSubmit={submit} noValidate>
        {!scale && editable && (
          <Select
            label="Start from"
            options={(templates.data ?? []).map(t => ({ value: t.key, label: t.name, description: t.description }))}
            value={values.templateKey}
            placeholder={templates.isLoading ? "Loading templates…" : "A blank scale"}
            hint={template ? "Change the bands as you like; kept as they are, the template is copied" : "Or pick a ready-made scale (CBSE, IB, US letter grades…)"}
            onChange={e => pickTemplate(e.target.value)}
          />
        )}
        <div className="form-grid">
          <TextInput label="Name" required maxLength={100} disabled={!editable} value={values.name} error={errors.name} onChange={e => set("name", e.target.value)} />
          <Field label="School default" hint="Used when an exam or policy names no scale">
            <Switch label={values.isDefault ? "Default scale" : "Not the default"} checked={values.isDefault} disabled={!editable || !!scale?.isDefault} onChange={v => set("isDefault", v)} />
          </Field>
        </div>
        <Textarea label="Description" rows={2} maxLength={1000} disabled={!editable} value={values.description} onChange={e => set("description", e.target.value)} />
        <Field
          label="Bands"
          hint="Each band runs from its % up to (not including) the next one's; 100% is in the top band. Untick Passing for failing grades."
          error={bandsMessage}
        >
          <div className="stack-sm">
            <CoverageBar rows={values.rows} />
            <BandsEditor
              rows={values.rows}
              onChange={r => {
                setValues(x => ({ ...x, rows: r }));
                setErrors(({ bands: _drop, ...rest }) => rest);
              }}
              disabled={!editable}
            />
          </div>
        </Field>
      </form>
    </Drawer>
  );
}
