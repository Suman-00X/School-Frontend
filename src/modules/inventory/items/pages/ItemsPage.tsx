/* IN-03 · Items: the store's items with stock on hand, reorder level and value */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useDebounce, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, SearchInput, Select, Switch } from "@/common/ui";
import { useAllCategories } from "../../categories/api/categories";
import { PageIntro } from "../../shared/components/PageIntro";
import { useMoney } from "../../shared/hooks/useMoney";
import { qty } from "../../shared/utils/format";
import { ITEMS_PATH, type Item } from "../api/items";
import { ItemStatus } from "../components/ItemBits";
import { ItemFormDrawer } from "../components/ItemFormDrawer";
import "../../shared/inventory.css";

export default function ItemsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const money = useMoney();
  /* discontinued: "" hides discontinued items, "all" shows them too */
  const { params, setParam, setPage } = useListParams({ q: "", categoryId: "", lowStock: "", discontinued: "" });
  const [text, setText] = useState(params.q);
  const q = useDebounce(text, 300);
  useEffect(() => {
    if (q.trim() !== params.q) setParam("q", q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const list = useApiList<Item>(ITEMS_PATH, {
    page: params.page,
    limit: params.limit,
    q: params.q || undefined,
    categoryId: params.categoryId || undefined,
    lowStock: params.lowStock === "true" ? true : undefined,
    discontinued: params.discontinued === "all" ? undefined : false
  });
  const categories = useAllCategories(can("inventory.categories.read"));
  const [creating, setCreating] = useState(false);
  const canManage = can("inventory.items.manage");

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      New item
    </Button>
  );
  const filtered = !!(params.q || params.categoryId || params.lowStock);

  return (
    <Page>
      <PageIntro actions={newButton}>Store items and what is on the shelf. Stock and average cost change only through stock movements.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <div className="field">
            <label className="field-label">Search</label>
            <SearchInput placeholder="SKU or name" value={text} onChange={e => setText(e.target.value)} aria-label="Search items" />
          </div>
          {can("inventory.categories.read") && (
            <Select
              label="Category"
              className="select-sm"
              value={params.categoryId}
              placeholder="All categories"
              options={(categories.data ?? []).map(c => ({ value: c.id, label: c.name }))}
              onChange={e => setParam("categoryId", e.target.value)}
            />
          )}
          <div className="row" style={{ gap: 16, alignSelf: "flex-end", minHeight: 30 }}>
            <Switch label="Low stock only" checked={params.lowStock === "true"} onChange={v => setParam("lowStock", v ? "true" : "")} />
            <Switch label="Show discontinued" checked={params.discontinued === "all"} onChange={v => setParam("discontinued", v ? "all" : "")} />
          </div>
        </div>
        <DataTable
          rows={list.rows}
          rowKey={i => i.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={i => navigate(`${ITEMS_PATH}/${i.id}`)}
          empty={
            params.lowStock === "true" && !params.q && !params.categoryId ? (
              <EmptyState icon={<Boxes />} title="Nothing at or below its reorder level" />
            ) : filtered ? (
              <EmptyState icon={<Boxes />} title="No item matches these filters" />
            ) : (
              <EmptyState icon={<Boxes />} title="No items yet" message="Add the items the store keeps, then receive stock against them." actions={newButton} />
            )
          }
          columns={[
            { key: "sku", header: "SKU", render: i => <span className="mono small nowrap">{i.sku}</span> },
            { key: "name", header: "Name", render: i => <strong>{i.name}</strong> },
            { key: "category", header: "Category", render: i => i.category?.name ?? <span className="muted">—</span> },
            { key: "unit", header: "Unit", render: i => <span className="mono small">{i.unit}</span> },
            { key: "stock", header: "In stock", align: "right", render: i => <strong className="in-num" style={{ color: i.isLowStock && !i.discontinued ? "var(--danger-text)" : undefined }}>{qty(i.stockOnHand)}</strong> },
            { key: "reorder", header: "Reorder at", align: "right", render: i => <span className="in-num">{qty(i.reorderLevel)}</span> },
            { key: "avg", header: "Avg cost", align: "right", render: i => <span className="in-num">{money(i.averageUnitCost)}</span> },
            { key: "value", header: "Stock value", align: "right", render: i => <span className="in-num">{money(i.stockValue)}</span> },
            { key: "location", header: "Location", render: i => (i.location ? <span className="in-cut small">{i.location}</span> : <span className="muted">—</span>) },
            { key: "status", header: "Status", render: i => <ItemStatus item={i} /> }
          ]}
        />
      </Card>
      <ItemFormDrawer
        open={creating}
        item={null}
        defaultCategoryId={params.categoryId || undefined}
        onClose={() => setCreating(false)}
        onSaved={i => navigate(`${ITEMS_PATH}/${i.id}`)}
      />
    </Page>
  );
}
