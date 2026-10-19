/* IN-03 · Item: stock facts, movements for this item, its ledger, details and history */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Scale, Trash2, Undo2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { useApiGet, useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, Card, DescriptionList, EmptyState, ErrorState, Page, Select, StatTile, StatTiles, TextInput, useConfirm, useTabParam, useToast, type TabItem } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, qty, UNIT_LABELS, type MovementType } from "../../shared/utils/format";
import type { Movement } from "../../stock/api/stock";
import { LedgerTable } from "../../stock/components/LedgerTable";
import { MovementDetailDrawer } from "../../stock/components/MovementDetailDrawer";
import { MovementDrawer } from "../../stock/components/MovementDrawer";
import { ITEMS_PATH, removeItem, type Item } from "../api/items";
import { ItemStatus } from "../components/ItemBits";
import { ItemFormDrawer } from "../components/ItemFormDrawer";
import "../../shared/inventory.css";

export default function ItemDetailPage() {
  const { itemId = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const money = useMoney();
  const [, setSearch] = useSearchParams();
  const item = useApiGet<Item>(`${ITEMS_PATH}/${itemId}`);
  const [moving, setMoving] = useState<MovementType | null>(null);
  const [editing, setEditing] = useState(false);
  const remove = useApiMutation(removeItem, { invalidate: [ITEMS_PATH, "/inventory/reports"] });

  const tabs: TabItem[] = [
    { id: "ledger", label: "Ledger", hidden: !can("inventory.stock.read") },
    { id: "details", label: "Details" },
    { id: "history", label: "History", hidden: !can("inventory.activity.read") }
  ];
  const [tab] = useTabParam(tabs);
  const first = tabs.find(t => !t.hidden)!.id;
  /* Each tab has its own filters and page */
  const switchTab = (id: string) => setSearch(id === first ? {} : { tab: id }, { replace: true });

  const i = item.data;
  const header = <DrillHeader back={ITEMS_PATH} backLabel="Back to items" title={i?.name ?? "Item"} tabs={tabs} value={tab} onChange={switchTab} />;

  if (item.error)
    return (
      <Page>
        {header}
        <ErrorState error={item.error} onRetry={() => void item.refetch()} />
      </Page>
    );

  const askRemove = async () => {
    if (!i) return;
    const ok = await confirm({
      title: `Remove ${i.name}?`,
      message: `${i.name} (${i.sku}) leaves the item list. Its ledger is kept. Only an item with nothing in stock can be removed.`,
      confirmLabel: "Remove item"
    });
    if (ok)
      remove.mutate(i.id, {
        onSuccess: res => {
          toast.success(res.message || `${i.name} removed`);
          navigate(ITEMS_PATH, { replace: true });
        },
        onError: e => toast.error(e)
      });
  };

  const canMove = can("inventory.stock.move");
  const actions = (
    <div className="row">
      {canMove && (
        <>
          <Button icon={<ArrowDownToLine />} disabled={!i || i.discontinued} title={i?.discontinued ? "Discontinued items take no new stock" : undefined} onClick={() => setMoving("RECEIPT")}>
            Receive
          </Button>
          <Button icon={<ArrowUpFromLine />} disabled={!i} onClick={() => setMoving("ISSUE")}>
            Issue
          </Button>
          <Button icon={<Undo2 />} disabled={!i} onClick={() => setMoving("RETURN")}>
            Take back
          </Button>
          {can("inventory.stock.adjust") && (
            <Button icon={<Scale />} disabled={!i} onClick={() => setMoving("ADJUSTMENT")}>
              Adjust
            </Button>
          )}
        </>
      )}
      {can("inventory.items.manage") && (
        <>
          <Button variant="ghost" icon={<Pencil />} disabled={!i} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" icon={<Trash2 />} disabled={!i} loading={remove.isPending} onClick={() => void askRemove()} aria-label="Remove item" title="Remove item" />
        </>
      )}
    </div>
  );

  return (
    <Page>
      {header}
      <Card>
        <div className="stack">
          <div className="row-between" style={{ gap: 12, alignItems: "center" }}>
            <div className="row in-header-line" style={{ gap: 8, minHeight: 34 }}>
              {i ? (
                <>
                  <Badge tone="primary">
                    <span className="mono">{i.sku}</span>
                  </Badge>
                  <ItemStatus item={i} />
                  <span className="small muted">
                    {[i.category?.name, `${UNIT_LABELS[i.unit]} (${i.unit})`, i.location].filter(Boolean).join(" · ")}
                  </span>
                </>
              ) : (
                <span className="skeleton" style={{ width: 240, height: 16, display: "inline-block" }} />
              )}
            </div>
            {actions}
          </div>
          <StatTiles>
            <StatTile
              label="In stock"
              value={i && qty(i.stockOnHand, i.unit)}
              hint={i ? (i.isLowStock ? "At or below the reorder level" : i.discontinued ? "Discontinued" : "Above the reorder level") : undefined}
              hintTone={i?.isLowStock ? "bad" : undefined}
              loading={!i}
            />
            <StatTile label="Reorder level" value={i && qty(i.reorderLevel, i.unit)} hint="Low stock at or below this" loading={!i} />
            <StatTile label="Average unit cost" value={i && money(i.averageUnitCost)} hint="Re-averaged on each receipt" loading={!i} />
            <StatTile label="Stock value" value={i && money(i.stockValue)} hint="Stock × average cost" loading={!i} />
          </StatTiles>
        </div>
      </Card>

      {i && tab === "ledger" && <ItemLedger item={i} />}
      {i && tab === "details" && (
        <Card title="Details">
          <DescriptionList
            columns={3}
            items={[
              { label: "SKU", value: <span className="mono">{i.sku}</span> },
              { label: "Name", value: i.name },
              { label: "Category", value: i.category?.name },
              { label: "Counted in", value: `${UNIT_LABELS[i.unit]} (${i.unit})` },
              { label: "Reorder level", value: qty(i.reorderLevel, i.unit) },
              { label: "Location", value: i.location },
              { label: "Discontinued", value: i.discontinued ? "Yes: takes no new stock, left out of low stock" : "No" },
              { label: "Added", value: formatDateTime(i.createdAt) },
              { label: "Last changed", value: formatDateTime(i.updatedAt) },
              { label: "Description", value: i.description, wide: true }
            ]}
          />
        </Card>
      )}
      {i && tab === "history" && <ActivityLog basePath="/inventory/activity" module="inventory" fixed={{ entityId: i.id }} compact title="History" />}

      {i && <MovementDrawer open={!!moving} preset={{ item: i, type: moving ?? undefined }} onClose={() => setMoving(null)} />}
      {i && <ItemFormDrawer open={editing} item={i} onClose={() => setEditing(false)} />}
    </Page>
  );
}

/* This item's ledger, newest first */
function ItemLedger({ item }: { item: Item }) {
  const { params, setParam, setPage } = useListParams({ type: "", from: "", to: "" });
  const [open, setOpen] = useState<Movement | null>(null);
  const list = useApiList<Movement>(`${ITEMS_PATH}/${item.id}/movements`, {
    page: params.page,
    limit: params.limit,
    type: params.type || undefined,
    from: params.from || undefined,
    to: params.to || undefined
  });
  const filtered = !!(params.type || params.from || params.to);
  return (
    <Card flush>
      <div className="filter-bar">
        <Select
          label="Type"
          className="select-sm"
          value={params.type}
          placeholder="All types"
          options={MOVEMENT_TYPES.map(t => ({ value: t, label: MOVEMENT_LABELS[t] }))}
          onChange={e => setParam("type", e.target.value)}
        />
        <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" min={params.from || undefined} value={params.to} onChange={e => setParam("to", e.target.value)} />
      </div>
      <LedgerTable
        withItem={false}
        rows={list.rows}
        meta={list.meta}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        onPageChange={setPage}
        onRowClick={setOpen}
        empty={<EmptyState title={filtered ? "No movements match these filters" : "No movements yet"} message={filtered ? undefined : "Receive stock to start this item's ledger."} />}
      />
      <MovementDetailDrawer movement={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
