/* IN-02 · Vendors: who the school buys store items from */
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useDebounce, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, SearchInput, useConfirm, useToast } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { removeVendor, VENDORS_PATH, type Vendor } from "../api/vendors";
import { VendorDrawer } from "../components/VendorDrawer";

export default function VendorsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setPage } = useListParams({ q: "" });
  const [text, setText] = useState(params.q);
  const q = useDebounce(text, 300);
  useEffect(() => {
    if (q.trim() !== params.q) setParam("q", q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const list = useApiList<Vendor>(VENDORS_PATH, { page: params.page, limit: params.limit, q: params.q || undefined });
  const [drawer, setDrawer] = useState<{ vendor: Vendor | null } | null>(null);
  const canManage = can("inventory.vendors.manage");
  const remove = useApiMutation(removeVendor, { invalidate: [VENDORS_PATH] });

  const askRemove = async (v: Vendor) => {
    if (!(await confirm({ title: `Remove ${v.name}?`, message: `${v.name} can no longer be picked for new receipts. Past receipts keep the vendor.`, confirmLabel: "Remove" }))) return;
    remove.mutate(v.id, { onSuccess: res => toast.success(res.message || `${v.name} removed`), onError: e => toast.error(e) });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ vendor: null })}>
      New vendor
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>Suppliers of store items. Receipts can name the vendor, so purchases can be traced back.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <div className="field">
            <label className="field-label">Search</label>
            <SearchInput placeholder="Name, contact, phone, email or tax id" value={text} onChange={e => setText(e.target.value)} aria-label="Search vendors" />
          </div>
        </div>
        <DataTable
          rows={list.rows}
          rowKey={v => v.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={v => setDrawer({ vendor: v })}
          empty={
            params.q ? (
              <EmptyState icon={<Truck />} title={`No vendor matches “${params.q}”`} />
            ) : (
              <EmptyState icon={<Truck />} title="No vendors yet" message="Add the shops and suppliers the school buys from." actions={newButton} />
            )
          }
          columns={[
            { key: "name", header: "Name", render: v => <strong>{v.name}</strong> },
            { key: "contact", header: "Contact person", render: v => v.contactPerson || <span className="muted">—</span> },
            { key: "phone", header: "Phone", render: v => (v.phone ? <span className="nowrap">{v.phone}</span> : <span className="muted">—</span>) },
            { key: "email", header: "Email", render: v => v.email || <span className="muted">—</span> },
            { key: "taxId", header: "Tax id", render: v => (v.taxId ? <span className="mono small">{v.taxId}</span> : <span className="muted">—</span>) },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: v =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ vendor: v })} aria-label={`Edit ${v.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(v)} aria-label={`Remove ${v.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <VendorDrawer open={!!drawer} vendor={drawer?.vendor ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Page>
  );
}
