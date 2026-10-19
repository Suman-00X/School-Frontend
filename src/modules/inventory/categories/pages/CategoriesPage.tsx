/* IN-01 · Categories: how store items are grouped (stationery, lab, sports…) */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useDebounce, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, SearchInput, useConfirm, useToast } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { CATEGORIES_PATH, removeCategory, type Category } from "../api/categories";
import { CategoryDrawer } from "../components/CategoryDrawer";

export default function CategoriesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { params, setParam, setPage } = useListParams({ q: "" });
  const [text, setText] = useState(params.q);
  const q = useDebounce(text, 300);
  useEffect(() => {
    if (q.trim() !== params.q) setParam("q", q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const list = useApiList<Category>(CATEGORIES_PATH, { page: params.page, limit: params.limit, q: params.q || undefined });
  const [drawer, setDrawer] = useState<{ category: Category | null } | null>(null);
  const canManage = can("inventory.categories.manage");
  const canItems = can("inventory.items.read");
  const remove = useApiMutation(removeCategory, { invalidate: [CATEGORIES_PATH] });

  const askRemove = async (c: Category) => {
    if (!(await confirm({ title: `Remove ${c.name}?`, message: `${c.name} can only be removed when no item is in it.`, confirmLabel: "Remove" }))) return;
    remove.mutate(c.id, {
      onSuccess: res => toast.success(res.message || `${c.name} removed`),
      onError: async err => {
        /* Items still in it: offer to open them */
        if (isApiError(err) && err.status === 422 && canItems) {
          if (await confirm({ title: `${c.name} can't be removed yet`, message: err.message, confirmLabel: "View its items", tone: "primary" })) navigate(`/inventory/items?categoryId=${c.id}`);
        } else toast.error(err);
      }
    });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ category: null })}>
      New category
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>Groups for store items, used to filter items and in the valuation report.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <div className="field">
            <label className="field-label">Search</label>
            <SearchInput placeholder="Category name" value={text} onChange={e => setText(e.target.value)} aria-label="Search categories" />
          </div>
        </div>
        <DataTable
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={c => setDrawer({ category: c })}
          empty={
            params.q ? (
              <EmptyState icon={<FolderTree />} title={`No category matches “${params.q}”`} />
            ) : (
              <EmptyState icon={<FolderTree />} title="No categories yet" message="Add a few, such as Stationery, Laboratory and Sports, before adding items." actions={newButton} />
            )
          }
          columns={[
            { key: "name", header: "Name", render: c => <strong>{c.name}</strong> },
            { key: "description", header: "Description", render: c => <span className="muted">{c.description || "—"}</span> },
            {
              key: "items",
              header: "",
              render: c =>
                canItems && (
                  <Link to={`/inventory/items?categoryId=${c.id}`} onClick={e => e.stopPropagation()} className="small nowrap">
                    View items
                  </Link>
                )
            },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: c =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ category: c })} aria-label={`Edit ${c.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(c)} aria-label={`Remove ${c.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <CategoryDrawer open={!!drawer} category={drawer?.category ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Page>
  );
}
