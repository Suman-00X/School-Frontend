/* FI-13 · Chart of accounts, grouped by type; a row opens the account's ledger */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, Select, SkeletonBlock, useConfirm, useToast, type Column } from "@/common/ui";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_HINTS, ACCOUNT_TYPE_LABELS, removeAccount, useAllAccounts, useLedgerMutation, type LedgerAccount } from "../api/ledger";
import { AccountDrawer } from "../components/AccountDrawer";

export default function AccountsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { params, setParam } = useListParams({ accountType: "" });
  const all = useAllAccounts();
  const [drawer, setDrawer] = useState<{ account: LedgerAccount | null } | null>(null);
  const remove = useLedgerMutation(removeAccount);
  const canManage = can("finance.ledger.manageAccounts");

  const askRemove = async (a: LedgerAccount) => {
    const ok = await confirm({
      title: `Remove ${a.code} ${a.name}?`,
      message: "Only an account with no entries can be removed. Its code becomes free again.",
      confirmLabel: "Remove account"
    });
    if (ok) remove.mutate(a.id, { onSuccess: res => toast.success(res.message || `${a.code} ${a.name} removed`), onError: e => toast.error(e) });
  };

  const columns: Column<LedgerAccount>[] = [
    { key: "code", header: "Code", width: 90, render: a => <span className="mono">{a.code}</span> },
    {
      key: "name",
      header: "Name",
      render: a => (
        <div>
          <div className="row" style={{ gap: 6 }}>
            {a.name}
            {a.isSystem && <Badge tone="info">System</Badge>}
            {a.isContra && <Badge>Contra</Badge>}
          </div>
          {a.description && <div className="small muted">{a.description}</div>}
        </div>
      )
    },
    { key: "normalBalance", header: "Normal balance", width: 140, render: a => (a.normalBalance === "DEBIT" ? "Debit" : "Credit") },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: a =>
        canManage ? (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Pencil />} title="Edit" aria-label={`Edit ${a.name}`} onClick={() => setDrawer({ account: a })} />
            {!a.isSystem && <Button size="sm" variant="ghost" icon={<Trash2 />} title="Remove" aria-label={`Remove ${a.name}`} onClick={() => void askRemove(a)} />}
          </div>
        ) : null
    }
  ];

  const types = params.accountType ? ACCOUNT_TYPES.filter(t => t === params.accountType) : ACCOUNT_TYPES;

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="The chart of accounts. Fees, payments, refunds and settlements post to them on their own."
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ account: null })}>
              New account
            </Button>
          )
        }
      />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Type"
            className="select-sm"
            value={params.accountType}
            placeholder="Every type"
            onChange={e => setParam("accountType", e.target.value)}
            options={ACCOUNT_TYPES.map(t => ({ value: t, label: ACCOUNT_TYPE_LABELS[t], description: ACCOUNT_TYPE_HINTS[t] }))}
          />
        </div>
        {all.error ? (
          <ErrorState error={all.error} onRetry={() => void all.refetch()} />
        ) : all.isLoading ? (
          <div className="card-body">
            <SkeletonBlock lines={8} />
          </div>
        ) : all.accounts.length === 0 ? (
          <EmptyState icon={<BookOpen />} title="No accounts yet" message="The system accounts are created the first time money is posted." />
        ) : (
          types.map(t => {
            const rows = all.accounts.filter(a => a.accountType === t);
            if (!rows.length && !params.accountType) return null;
            return (
              <div key={t}>
                <div className="card-body" style={{ paddingBottom: 6, paddingTop: 14 }}>
                  <div className="section-title" style={{ margin: 0 }}>
                    {ACCOUNT_TYPE_LABELS[t]} <span className="muted small">· {ACCOUNT_TYPE_HINTS[t]}</span>
                  </div>
                </div>
                <DataTable
                  columns={columns}
                  rows={rows}
                  rowKey={a => a.id}
                  onRowClick={a => navigate(OPS_PATHS.account(a.id))}
                  empty={<EmptyState title={`No ${ACCOUNT_TYPE_LABELS[t].toLowerCase()} accounts.`} />}
                />
              </div>
            );
          })
        )}
      </Card>
      <AccountDrawer open={!!drawer} account={drawer?.account ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </>
  );
}
