/* LB-01 · Policy and circulation rules: the Circulation rules tab (list + drawer) */
import { useState } from "react";
import { Plus, Scale } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Select, roleLabel, type Column } from "@/common/ui";
import type { CirculationRule } from "../../shared/api/types";
import { LibraryIntro } from "../../shared/components/LibraryBits";
import { useClassOptions, useMoney } from "../../shared/hooks/useLibraryLookups";
import { BORROWER_ROLES, ITEM_TYPE_LABELS, LOANABLE_ITEM_TYPES } from "../../shared/utils/labels";
import { RULES_PATH } from "../api/rules";
import { RuleDrawer } from "../components/RuleDrawer";

export default function RulesPage() {
  const { can } = useAuth();
  const canEdit = can("library.circulationRules.manage");
  const money = useMoney();
  const classes = useClassOptions();
  const { params, setParam, setPage } = useListParams({ borrowerRole: "", classId: "", itemType: "" });
  const list = useApiList<CirculationRule>(RULES_PATH, params);
  const [drawer, setDrawer] = useState<{ rule: CirculationRule | null } | null>(null);
  const filtered = !!(params.borrowerRole || params.classId || params.itemType);

  const newButton = canEdit && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ rule: null })}>
      New rule
    </Button>
  );

  const columns: Column<CirculationRule>[] = [
    { key: "appliesTo", header: "Applies to", render: r => r.appliesTo.charAt(0).toUpperCase() + r.appliesTo.slice(1) },
    { key: "loanDays", header: "Loan days", align: "right", render: r => <span className="num">{r.loanDays}</span> },
    { key: "maxLoans", header: "Max loans", align: "right", render: r => <span className="num">{r.maxLoans}</span> },
    { key: "maxRenewals", header: "Renewals", align: "right", render: r => <span className="num">{r.maxRenewals}</span> },
    { key: "finePerDay", header: "Fine/day", align: "right", render: r => <span className="num">{money(r.finePerDay)}</span> },
    { key: "fineGraceDays", header: "Grace days", align: "right", render: r => <span className="num">{r.fineGraceDays}</span> },
    {
      key: "maxFine",
      header: "Max fine",
      align: "right",
      render: r => (r.maxFine === null ? <span className="muted">No cap</span> : <span className="num">{money(r.maxFine)}</span>)
    }
  ];

  return (
    <div className="stack">
      <LibraryIntro actions={newButton}>Loan terms per kind of borrower. The most specific rule applies; changes don't touch loans already issued.</LibraryIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Borrower"
            className="select-sm"
            value={params.borrowerRole}
            onChange={e => setParam("borrowerRole", e.target.value)}
            placeholder="Any borrower"
            options={BORROWER_ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
          />
          <Select label="Class" className="select-sm" value={params.classId} onChange={e => setParam("classId", e.target.value)} placeholder="Any class" options={classes} />
          <Select
            label="Item type"
            className="select-sm"
            value={params.itemType}
            onChange={e => setParam("itemType", e.target.value)}
            placeholder="Any item"
            options={LOANABLE_ITEM_TYPES.map(t => ({ value: t, label: ITEM_TYPE_LABELS[t] }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => setDrawer({ rule: r })}
          empty={
            filtered ? (
              <EmptyState icon={<Scale />} title="No rule matches these filters" message="The rule for any borrower still applies to them." />
            ) : (
              <EmptyState icon={<Scale />} title="No circulation rules" message="Without a rule nobody can borrow. Add one for any borrower first." actions={newButton} />
            )
          }
        />
      </Card>
      <RuleDrawer open={!!drawer} rule={drawer?.rule ?? null} canEdit={canEdit} onClose={() => setDrawer(null)} />
    </div>
  );
}
