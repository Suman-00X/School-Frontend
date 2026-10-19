import { ListOrdered } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiGet, useApiList, useApiMutation } from "@/common/hooks";
import { Button, Card, RadioGroup, useConfirm, useToast } from "@/common/ui";
import { SECTIONS_PATH } from "../api/sections";
import { ROLL_NUMBER_ORDERS, ROLL_POLICY_PATH, updateRollPolicy, type RollNumberOrder, type RollNumberPolicy } from "../api/rollNumbers";

/* The school-wide roll-number rule, and renumbering the whole year by it. Always the same size:
   the choices are disabled (not swapped for text) for those who can't change it, and the
   year-wide button is left out only by permission, never after loading. */
export function RollNumberRuleCard({ onAssignAll }: { onAssignAll: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const policy = useApiGet<RollNumberPolicy>(ROLL_POLICY_PATH);
  const save = useApiMutation(updateRollPolicy, { invalidate: [ROLL_POLICY_PATH] });
  const canManage = can("academics.enrollments.managePolicy");
  const canAssign = can("academics.enrollments.assignRollNumbers");
  /* Whether the header's year has any section to number */
  const sections = useApiList(SECTIONS_PATH, { limit: 1 }, { enabled: canAssign });
  const hasSections = (sections.meta?.total ?? 0) > 0;

  const current = policy.data?.rollNumberOrder;

  const change = async (next: RollNumberOrder) => {
    if (next === current) return;
    const ok = await confirm({
      title: `Order roll numbers ${next === "ALPHABETICAL" ? "alphabetically" : "by last year's result"}?`,
      message: `The new rule applies the next time roll numbers are assigned and in promotions. Numbers already given don't change until you assign them again.`,
      confirmLabel: "Change rule",
      tone: "primary"
    });
    if (ok)
      save.mutate(
        { rollNumberOrder: next },
        { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) }
      );
  };

  return (
    <Card title="Roll numbers" subtitle="School-wide rule for the order">
      <div className="roll-rule">
        {/* Two choices, both shown with what they mean. Disabled (not hidden) for those who can't change it. */}
        <RadioGroup
          aria-label="Roll-number order"
          options={ROLL_NUMBER_ORDERS.map(o => ({ value: o.value, label: o.label, description: o.hint }))}
          value={current ?? ""}
          disabled={!canManage || !current || save.isPending}
          title={canManage ? undefined : "Only an administrator or the principal can change the rule"}
          onChange={next => void change(next)}
        />
        {policy.error && <div className="small" style={{ color: "var(--danger)" }}>Couldn't load the rule.</div>}
        {canAssign && (
          <Button
            size="sm"
            icon={<ListOrdered />}
            disabled={readOnly || !hasSections}
            title={readOnly ? `${year?.yearName ?? "This year"} is archived` : !hasSections ? "No sections in this year" : undefined}
            onClick={onAssignAll}
          >
            Assign for all of {year?.yearName ?? "the year"}
          </Button>
        )}
      </div>
    </Card>
  );
}
