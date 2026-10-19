/* LB-03 · Catalogue (staff view): titles with copy counts, scan to find a copy */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookPlus, LibraryBig } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Field, Page, SearchInput, Select, Switch, useToast, type Column } from "@/common/ui";
import type { Book } from "../../shared/api/types";
import { ItemTypeBadge, LibraryIntro, ScanInput } from "../../shared/components/LibraryBits";
import { useBookOptions, useSubjectOptions } from "../../shared/hooks/useLibraryLookups";
import { useSearchBox } from "../../shared/hooks/useSearchBox";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../shared/utils/labels";
import { findCopy } from "../../copies/api/copies";
import { CopyDrawer } from "../../copies/components/CopyDrawer";
import { BOOKS_PATH } from "../api/books";
import { BookDrawer } from "../components/BookDrawer";

export default function BooksPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { params, setParam, setParams, setPage } = useListParams({ q: "", category: "", subjectId: "", itemType: "", available: "" });
  const [search, setSearch] = useSearchBox(params.q, q => setParam("q", q));
  const list = useApiList<Book>(BOOKS_PATH, params);
  const { categories } = useBookOptions();
  const subjects = useSubjectOptions();
  const [creating, setCreating] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [scan, setScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const canScan = can("library.copies.read");

  const lookUp = async (code: string) => {
    setScanning(true);
    try {
      const copy = await findCopy(code);
      if (copy) {
        setCopyId(copy.id);
        setScan("");
      } else toast.error(`No copy has the code ${code.toUpperCase()}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setScanning(false);
    }
  };

  const filtered = !!(params.q || params.category || params.subjectId || params.itemType || params.available);
  const newButton = can("library.books.manage") && (
    <Button variant="primary" icon={<BookPlus />} onClick={() => setCreating(true)}>
      New book
    </Button>
  );

  const columns: Column<Book>[] = [
    {
      key: "title",
      header: "Title",
      render: b => (
        <div style={{ minWidth: 0 }}>
          <div className="person-name">{b.title}</div>
          {b.subtitle && <div className="person-sub">{b.subtitle}</div>}
        </div>
      )
    },
    { key: "authors", header: "Authors", render: b => (b.authors.length ? b.authors.join(", ") : <span className="muted">—</span>) },
    { key: "isbn", header: "ISBN", render: b => (b.isbn ? <span className="mono small">{b.isbn}</span> : <span className="muted">—</span>) },
    { key: "itemType", header: "Type", render: b => <ItemTypeBadge type={b.itemType} /> },
    { key: "shelfLocation", header: "Shelf", render: b => b.shelfLocation ?? <span className="muted">—</span> },
    {
      key: "copies",
      header: "Available",
      align: "right",
      render: b => (
        <span className={`num${b.copies.total && !b.copies.available ? " text-warning" : ""}`}>
          {b.copies.available} / {b.copies.total}
        </span>
      )
    },
    { key: "holdsWaiting", header: "Waiting", align: "right", render: b => (b.holdsWaiting ? <span className="num">{b.holdsWaiting}</span> : <span className="muted">—</span>) }
  ];

  return (
    <Page>
      <LibraryIntro
        actions={
          <>
            {canScan && (
              <ScanInput
                ref={scanRef}
                style={{ width: 230 }}
                placeholder="Scan a copy or type ACC-…"
                aria-label="Find a copy by accession number or barcode"
                value={scan}
                disabled={scanning}
                onChange={e => setScan(e.target.value)}
                onScan={code => void lookUp(code)}
              />
            )}
            {newButton}
          </>
        }
      >
        Every title the library holds, with its copies.
      </LibraryIntro>
      <Card flush>
        <div className="filter-bar">
          <Field label="Search" className="filter-wide">
            <SearchInput placeholder="Title, author or ISBN" value={search} onChange={e => setSearch(e.target.value)} />
          </Field>
          <Select
            label="Category"
            className="select-sm"
            value={params.category}
            onChange={e => setParam("category", e.target.value)}
            placeholder="All categories"
            options={categories.map(c => ({ value: c, label: c }))}
          />
          {can("academics.subjects.read") && (
            <Select label="Subject" className="select-sm" value={params.subjectId} onChange={e => setParam("subjectId", e.target.value)} placeholder="All subjects" options={subjects} />
          )}
          <Select
            label="Type"
            className="select-sm"
            value={params.itemType}
            onChange={e => setParam("itemType", e.target.value)}
            placeholder="All types"
            options={ITEM_TYPES.map(t => ({ value: t, label: ITEM_TYPE_LABELS[t] }))}
          />
          <Field label="Availability">
            <div style={{ height: 36, display: "flex", alignItems: "center" }}>
              <Switch label="Available now" checked={params.available === "true"} onChange={v => setParams({ available: v ? "true" : "" })} />
            </div>
          </Field>
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={b => b.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={b => navigate(`/library/books/${b.id}`)}
          empty={
            filtered ? (
              <EmptyState icon={<LibraryBig />} title="No book matches" message="Try fewer words or another filter." />
            ) : (
              <EmptyState icon={<LibraryBig />} title="The catalogue is empty" message="Add a title, then its copies." actions={newButton} />
            )
          }
        />
      </Card>
      <BookDrawer open={creating} book={null} onClose={() => setCreating(false)} />
      <CopyDrawer
        copyId={copyId}
        onClose={() => {
          setCopyId(null);
          scanRef.current?.focus();
        }}
      />
    </Page>
  );
}
