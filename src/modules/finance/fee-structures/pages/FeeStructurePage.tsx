/* FI-03 · Fee structure (detail and create): items, offered plans and late fee of one structure */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FilePlus2, Receipt, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, ButtonLink, Card, ErrorState, Field, FormActions, NotFound, Page, Select, SkeletonBlock, Switch, TextInput, Textarea, useConfirm, useToast, type Option } from "@/common/ui";
import { useFeeHeadOptions } from "../../fee-heads";
import { usePlanOptions } from "../../installment-plans";
import { useRuleOptions } from "../../late-fee-rules";
import { feeStructurePath, hasTooManyDecimals, parseAmount, SETUP_PATHS, useClassOptions, useMoney } from "../../shared";
import {
  createStructure,
  removeStructure,
  STRUCTURES_PATH,
  updateStructure,
  useStructure,
  useStructureHasInvoices,
  type FeeStructure,
  type StructureInput
} from "../api/feeStructures";
import { ItemsGrid, itemsFrom, itemsInput, itemsTotal, newItem, type ItemRow } from "../components/ItemsGrid";
import { PlansPanel } from "../components/PlansPanel";
import "../components/feeStructures.css";

type Values = { name: string; classId: string; description: string };

/* "" in the class picker: every class */
const EVERY_CLASS = "";

const FROZEN = "Invoices have been issued from this structure; its items can no longer change.";

export default function FeeStructurePage() {
  const { feeStructureId } = useParams();
  const isNew = !feeStructureId;
  const structure = useStructure(feeStructureId ?? null);

  return (
    <Page>
      <DrillHeader
        back={SETUP_PATHS.feeStructures}
        backLabel="Back to fee structures"
        title={isNew ? "New fee structure" : (structure.data?.name ?? "Fee structure")}
      />
      {isNew ? (
        <StructureEditor structure={null} />
      ) : structure.error ? (
        isApiError(structure.error) && structure.error.status === 404 ? (
          <NotFound message="This fee structure does not exist or was removed." />
        ) : (
          <ErrorState error={structure.error} onRetry={() => void structure.refetch()} />
        )
      ) : !structure.data ? (
        <div className="structure-layout">
          <div>
            <Card title="Fee items">
              <SkeletonBlock lines={6} />
            </Card>
          </div>
          <div>
            <Card title="Plans">
              <SkeletonBlock lines={3} />
            </Card>
            <Card title="Late fee">
              <SkeletonBlock lines={2} />
            </Card>
          </div>
        </div>
      ) : (
        <StructureEditor key={structure.data.id} structure={structure.data} />
      )}
    </Page>
  );
}

function StructureEditor({ structure }: { structure: FeeStructure | null }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const money = useMoney();
  const { selected: year, readOnly: archived } = useAcademicYear();
  const canEdit = can("finance.feeStructures.manage") && !archived;
  const heads = useFeeHeadOptions();
  const plans = usePlanOptions(canEdit);
  const rules = useRuleOptions();
  const classes = useClassOptions(!structure && canEdit);
  const hasInvoices = useStructureHasInvoices(structure?.id ?? null);
  const [frozenByServer, setFrozenByServer] = useState(false);
  const frozen = !!structure && (hasInvoices === true || frozenByServer);

  const initial = useMemo(
    () => ({
      values: { name: structure?.name ?? "", classId: structure?.classId ?? EVERY_CLASS, description: structure?.description ?? "" },
      items: structure ? itemsFrom(structure.items) : [newItem()],
      offered: structure?.installmentPlans.map(p => p.id) ?? [],
      defaultId: structure?.defaultInstallmentPlanId ?? "",
      chargesLateFee: structure?.chargesLateFee ?? true,
      ruleId: structure?.lateFeeRuleId ?? ""
    }),
    [structure]
  );

  const form = useForm<Values>(initial.values);
  const [items, setItems] = useState<ItemRow[]>(initial.items);
  const [offered, setOffered] = useState<string[]>(initial.offered);
  const [defaultId, setDefaultId] = useState(initial.defaultId);
  const [chargesLateFee, setChargesLateFee] = useState(initial.chargesLateFee);
  const [ruleId, setRuleId] = useState(initial.ruleId);
  const [panelErrors, setPanelErrors] = useState<{ items?: string; plans?: string; lateFee?: string }>({});

  /* A save brings a new structure: adopt it */
  const previous = useRef(structure?.updatedAt);
  useEffect(() => {
    if (structure?.updatedAt === previous.current) return;
    previous.current = structure?.updatedAt;
    form.reset(initial.values);
    setItems(initial.items);
    setOffered(initial.offered);
    setDefaultId(initial.defaultId);
    setChargesLateFee(initial.chargesLateFee);
    setRuleId(initial.ruleId);
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = [STRUCTURES_PATH, "/finance/invoices"];
  const create = useApiMutation(createStructure, { invalidate });
  const update = useApiMutation(updateStructure, { invalidate });
  const remove = useApiMutation(removeStructure, { invalidate });

  /* ---- what changed (PATCH) ---- */
  const v = form.values;
  const itemsChanged = JSON.stringify(itemsInput(items)) !== JSON.stringify(itemsInput(initial.items));
  const plansChanged = [...offered].sort().join() !== [...initial.offered].sort().join();
  const patch: Partial<StructureInput> = {};
  if (structure) {
    if (v.name.trim() !== structure.name) patch.name = v.name.trim();
    if (v.description.trim() !== (structure.description ?? "")) patch.description = v.description.trim();
    if (itemsChanged && !frozen) patch.items = itemsInput(items);
    if (plansChanged) patch.installmentPlanIds = offered;
    if (defaultId !== initial.defaultId) patch.defaultInstallmentPlanId = defaultId;
    if (chargesLateFee !== initial.chargesLateFee) patch.chargesLateFee = chargesLateFee;
    if (chargesLateFee && ruleId !== initial.ruleId) patch.lateFeeRuleId = ruleId || null;
  }
  const dirty = !structure || Object.keys(patch).length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!v.name.trim()) e.name = "Enter a name, e.g. Class 6 fees 2026-27";
    if (!structure || patch.items) {
      items.forEach((r, i) => {
        if (!r.feeHeadId) e[`items.${i}.feeHeadId`] = "Pick a fee head";
        const n = parseAmount(r.amount);
        if (n === null || n <= 0) e[`items.${i}.amount`] = "More than 0";
        else if (hasTooManyDecimals(r.amount)) e[`items.${i}.amount`] = "At most 2 decimals";
      });
    }
    form.setErrors(e);
    const panels: typeof panelErrors = {};
    if (!offered.length) panels.plans = "Offer at least one plan";
    else if (!defaultId || !offered.includes(defaultId)) panels.plans = "Pick the default plan";
    setPanelErrors(panels);
    const ok = !Object.keys(e).length && !Object.keys(panels).length;
    if (!ok) form.setFormError("Please correct the highlighted fields.");
    return ok;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /items can no longer change/i.test(err.message)) {
      setFrozenByServer(true);
      setPanelErrors({ items: err.message });
      form.setFormError("Items are frozen. Save again to keep the other changes.");
    } else if (isApiError(err) && err.status === 409 && /already exists/i.test(err.message)) {
      form.setErrors({ name: err.message });
      form.setFormError(null);
    } else if (isApiError(err) && err.status === 409) {
      /* A plan with invoices from this structure must stay offered (the message names it) */
      setPanelErrors({ plans: err.message });
      form.setFormError(err.message);
    } else if (isApiError(err) && err.status === 422) {
      if (/plan/i.test(err.message)) setPanelErrors({ plans: err.message });
      else if (/late fee/i.test(err.message)) setPanelErrors({ lateFee: err.message });
      else if (/item|fee head/i.test(err.message)) setPanelErrors({ items: err.message });
      form.setFormError(err.message);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    setPanelErrors({});
    if (!dirty || !validate()) return;
    if (!structure) {
      const body: StructureInput = {
        name: v.name.trim(),
        items: itemsInput(items),
        installmentPlanIds: offered,
        defaultInstallmentPlanId: defaultId,
        chargesLateFee
      };
      if (v.classId) body.classId = v.classId;
      if (v.description.trim()) body.description = v.description.trim();
      if (chargesLateFee && ruleId) body.lateFeeRuleId = ruleId;
      create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          navigate(feeStructurePath(res.data.id), { replace: true });
        },
        onError
      });
    } else
      update.mutate(
        { id: structure.id, ...patch },
        {
          onSuccess: res => {
            toast.success(res.message);
            form.setFormError(null);
          },
          onError
        }
      );
  };

  const discard = () => {
    form.reset(initial.values);
    setItems(initial.items);
    setOffered(initial.offered);
    setDefaultId(initial.defaultId);
    setChargesLateFee(initial.chargesLateFee);
    setRuleId(initial.ruleId);
    setPanelErrors({});
  };

  const askRemove = async () => {
    if (!structure) return;
    const ok = await confirm({
      title: `Remove ${structure.name}?`,
      message: `${structure.name} (${structure.class?.className ?? "every class"}, ${money(structure.totalAmount)} a year) will no longer bill anyone. A structure with invoices can't be removed: cancel them first.`,
      confirmLabel: "Remove structure"
    });
    if (ok)
      remove.mutate(structure.id, {
        onSuccess: res => {
          toast.success(res.message);
          navigate(SETUP_PATHS.feeStructures);
        },
        onError: e => toast.error(e)
      });
  };

  /* ---- pickers ---- */
  const ruleOptions: Option[] = useMemo(
    () => [
      { value: "", label: rules.defaultRule ? `School default (${rules.defaultRule.name})` : "School default", description: rules.defaultRule ? undefined : "No rule is the school default yet: nothing is charged" },
      ...rules.rules.map(r => ({ value: r.id, label: r.name, description: r.isDefault ? "The school default" : (r.description ?? undefined) }))
    ],
    [rules.rules, rules.defaultRule]
  );
  /* A head removed since keeps its row: the structure still names it */
  const headOptions: Option[] = useMemo(() => {
    const known = new Set(heads.options.map(o => o.value));
    const gone = (structure?.items ?? []).filter(i => !known.has(i.feeHeadId)).map(i => ({ value: i.feeHeadId, label: i.feeHead.name, description: i.feeHead.code }));
    return [...heads.options, ...gone];
  }, [heads.options, structure]);
  const classOptions: Option[] = useMemo(() => [{ value: EVERY_CLASS, label: "Every class" }, ...classes.options], [classes.options]);
  /* The year's plans; readers see the offered ones as the structure embeds them */
  const planList = canEdit ? plans.plans : (structure?.installmentPlans ?? []);
  const itemsReadOnly = !canEdit || frozen;
  const busy = create.isPending || update.isPending;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="structure-summary">
        {structure ? (
          <>
            <span>
              <span className="muted">Class</span> <strong>{structure.class?.className ?? "Every class"}</strong>
            </span>
            <span>
              <span className="muted">Year</span> <strong>{year?.id === structure.academicYearId ? year.yearName : "Another year"}</strong>
            </span>
            <span>
              <span className="muted">Annual total</span> <strong className="amount">{money(itemsTotal(items))}</strong>
            </span>
            {frozen && <Badge tone="warning">Invoices issued</Badge>}
            <span style={{ marginLeft: "auto" }} className="row">
              {can("finance.invoices.read") && (
                <ButtonLink icon={<Receipt />} to={`/finance/invoices?feeStructureId=${structure.id}`}>
                  Invoices
                </ButtonLink>
              )}
              {can("finance.invoices.issue") && !archived && year?.id === structure.academicYearId && (
                <ButtonLink icon={<FilePlus2 />} to={`/finance/invoices?generate=${structure.id}`}>
                  Generate invoices
                </ButtonLink>
              )}
              {canEdit && (
                <Button icon={<Trash2 />} variant="ghost" onClick={() => void askRemove()} loading={remove.isPending}>
                  Remove
                </Button>
              )}
            </span>
          </>
        ) : (
          <span className="muted">For {year?.yearName ?? "the selected year"}. Students of the class are billed from it, one invoice per installment of their plan.</span>
        )}
      </div>

      <div className="structure-layout">
        <div>
          <Card title="Details">
            <div className="form-grid">
              <TextInput label="Name" required autoFocus={!structure} maxLength={100} placeholder={`Class 6 fees ${year?.yearName ?? ""}`.trim()} disabled={!canEdit} {...form.text("name")} />
              {structure ? (
                <TextInput label="Class" value={structure.class?.className ?? "Every class"} disabled readOnly hint="The class can't change once created" />
              ) : (
                <Select label="Class" options={classOptions} required hint="Or every class, for fees everyone pays" disabled={!canEdit} {...form.text("classId")} />
              )}
              <Textarea label="Description" rows={2} maxLength={1000} fieldClassName="span-2" disabled={!canEdit} {...form.text("description")} />
            </div>
          </Card>
          <Card title="Fee items" subtitle="The annual amount of each fee head">
            {heads.isLoading ? (
              <SkeletonBlock lines={4} />
            ) : (
              <ItemsGrid
                rows={items}
                onChange={next => {
                  setItems(next);
                  setPanelErrors(p => ({ ...p, items: undefined }));
                  form.setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("items."))));
                }}
                headOptions={headOptions}
                errors={form.errors}
                message={panelErrors.items ?? null}
                readOnly={itemsReadOnly}
                frozenNote={frozen ? (panelErrors.items ?? FROZEN) : null}
              />
            )}
          </Card>
        </div>
        <div>
          <Card title="Plans" subtitle="How families can pay this structure">
            <PlansPanel
              plans={planList}
              loading={canEdit && plans.isLoading}
              offered={offered}
              defaultId={defaultId}
              readOnly={!canEdit}
              message={panelErrors.plans ?? null}
              onChange={(next, def) => {
                setOffered(next);
                setDefaultId(def);
                setPanelErrors(p => ({ ...p, plans: undefined }));
              }}
            />
          </Card>
          <Card title="Late fee" subtitle="Charged on overdue invoices by the daily run">
            <div className="stack-sm">
              <Field hint={chargesLateFee ? undefined : "Invoices from this structure are never charged a late fee"}>
                <Switch label="Charge late fees" checked={chargesLateFee} disabled={!canEdit} onChange={setChargesLateFee} />
              </Field>
              <Select
                label="Rule"
                options={ruleOptions}
                value={chargesLateFee ? ruleId : ""}
                onChange={e => setRuleId(e.target.value)}
                disabled={!canEdit || !chargesLateFee}
                required
                error={panelErrors.lateFee}
                hint={rules.allowed ? undefined : "Late-fee rules are not visible to you"}
              />
            </div>
          </Card>
        </div>
      </div>
      {canEdit && (
        <FormActions error={form.formError}>
          {structure && (
            <Button onClick={discard} disabled={!dirty || busy}>
              Discard changes
            </Button>
          )}
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
            {structure ? "Save changes" : "Create structure"}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
