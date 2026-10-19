/* IN-04 · Stock movements: the append-only ledger across all items, and recording a movement */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, EmptyState, Page, Select, TextInput } from "@/common/ui";
import { useEmployees } from "@/modules/administration";
import { studentName, useStudentOptions } from "@/modules/users";
import { useAllItems } from "../../items/api/items";
import { PageIntro } from "../../shared/components/PageIntro";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementType } from "../../shared/utils/format";
import { useAllVendors } from "../../vendors/api/vendors";
import { MOVEMENTS_PATH, type Movement } from "../api/stock";
import { LedgerTable } from "../components/LedgerTable";
import { MovementDetailDrawer } from "../components/MovementDetailDrawer";
import { MovementDrawer } from "../components/MovementDrawer";

export default function MovementsPage() {
  const { can } = useAuth();
  const { params, setParam, setPage } = useListParams({ type: "", itemId: "", vendorId: "", issuedToUserId: "", from: "", to: "" });
  const list = useApiList<Movement>(MOVEMENTS_PATH, {
    page: params.page,
    limit: params.limit,
    type: params.type || undefined,
    itemId: params.itemId || undefined,
    vendorId: params.vendorId || undefined,
    issuedToUserId: params.issuedToUserId || undefined,
    from: params.from || undefined,
    to: params.to || undefined
  });
  const items = useAllItems(can("inventory.items.read"));
  const vendors = useAllVendors(can("inventory.vendors.read"));
  const students = useStudentOptions();
  const staff = useEmployees();
  const [openRow, setOpenRow] = useState<Movement | null>(null);
  const canMove = can("inventory.stock.move");

  /* ?new=RECEIPT (quick action) opens the form with that type */
  const [search, setSearch] = useSearchParams();
  const asked = search.get("new");
  const [clicked, setClicked] = useState(false);
  const recording = canMove && (clicked || !!asked);
  const presetType = asked && (MOVEMENT_TYPES as readonly string[]).includes(asked) ? (asked as MovementType) : undefined;
  const closeForm = () => {
    setClicked(false);
    if (asked)
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete("new");
          return next;
        },
        { replace: true }
      );
  };

  /* Students (and staff, when the person may list them) for the "issued to" filter */
  const people = useMemo(() => {
    const out = students.students.map(s => ({ value: s.userId, label: studentName(s), description: `Student · ${s.admissionNumber}` }));
    for (const p of staff.people) out.push({ value: p.id, label: p.name, description: "Staff" });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [students.students, staff.people]);

  const filtered = Object.entries(params).some(([k, v]) => k !== "page" && k !== "limit" && v);
  const recordButton = canMove && (
    <Button variant="primary" icon={<Plus />} onClick={() => setClicked(true)}>
      Record movement
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={recordButton}>Every receipt, issue, return and adjustment, newest first. Movements are permanent; a mistake is fixed with an adjustment.</PageIntro>
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
          {can("inventory.items.read") && (
            <Select
              label="Item"
              className="select-sm"
              value={params.itemId}
              placeholder="All items"
              searchable
              options={(items.data ?? []).map(i => ({ value: i.id, label: i.name, description: i.sku }))}
              onChange={e => setParam("itemId", e.target.value)}
            />
          )}
          {can("inventory.vendors.read") && (
            <Select
              label="Vendor"
              className="select-sm"
              value={params.vendorId}
              placeholder="All vendors"
              options={(vendors.data ?? []).map(v => ({ value: v.id, label: v.name }))}
              onChange={e => setParam("vendorId", e.target.value)}
            />
          )}
          {people.length > 0 && (
            <Select
              label="Issued to"
              className="select-sm"
              value={params.issuedToUserId}
              placeholder="Anyone"
              searchable
              options={people}
              onChange={e => setParam("issuedToUserId", e.target.value)}
            />
          )}
          <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" min={params.from || undefined} value={params.to} onChange={e => setParam("to", e.target.value)} />
        </div>
        <LedgerTable
          rows={list.rows}
          meta={list.meta}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          onPageChange={setPage}
          onRowClick={setOpenRow}
          empty={
            filtered ? (
              <EmptyState icon={<ArrowLeftRight />} title="No movements match these filters" />
            ) : (
              <EmptyState icon={<ArrowLeftRight />} title="No stock movements yet" message="Receive stock against an item to start its ledger." actions={recordButton} />
            )
          }
        />
      </Card>
      <MovementDetailDrawer movement={openRow} onClose={() => setOpenRow(null)} />
      <MovementDrawer open={recording} preset={{ type: presetType }} onClose={closeForm} />
    </Page>
  );
}
