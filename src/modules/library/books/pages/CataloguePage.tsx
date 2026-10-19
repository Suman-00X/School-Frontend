/* LB-03 · Catalogue (browse view): search the library and see what is on the shelf. Read-only. */
import { Link } from "react-router-dom";
import { LibraryBig } from "lucide-react";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Card, EmptyState, ErrorState, Field, Page, Pagination, SearchInput, Select, Skeleton, Switch } from "@/common/ui";
import type { CatalogueEntry } from "../../shared/api/types";
import { LibraryIntro } from "../../shared/components/LibraryBits";
import { useBookOptions, useSubjectOptions } from "../../shared/hooks/useLibraryLookups";
import { useSearchBox } from "../../shared/hooks/useSearchBox";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../shared/utils/labels";
import { CATALOGUE_PATH } from "../api/books";

/* "2 of 5 available · 3 waiting" */
export const availabilityLine = (a: CatalogueEntry["availability"]) =>
  [a.total ? `${a.available} of ${a.total} available` : "No copies yet", a.holdsWaiting ? `${a.holdsWaiting} waiting` : ""].filter(Boolean).join(" · ");

export default function CataloguePage() {
  const { params, setParam, setParams, setPage } = useListParams({ q: "", category: "", subjectId: "", itemType: "", available: "" }, { limit: 24 });
  const [search, setSearch] = useSearchBox(params.q, q => setParam("q", q));
  const list = useApiList<CatalogueEntry>(CATALOGUE_PATH, params);
  const { categories } = useBookOptions();
  const subjects = useSubjectOptions();
  const filtered = !!(params.q || params.category || params.subjectId || params.itemType || params.available);

  return (
    <Page>
      <LibraryIntro>Search the school library. Ask at the desk to borrow a book, or reserve one from your library page.</LibraryIntro>
      <Card flush>
        <div className="filter-bar">
          <Field label="Search" className="filter-wide">
            <SearchInput placeholder="Title, author or ISBN" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </Field>
          <Select
            label="Category"
            className="select-sm"
            value={params.category}
            onChange={e => setParam("category", e.target.value)}
            placeholder="All categories"
            options={categories.map(c => ({ value: c, label: c }))}
          />
          <Select label="Subject" className="select-sm" value={params.subjectId} onChange={e => setParam("subjectId", e.target.value)} placeholder="All subjects" options={subjects} />
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
        <div style={{ padding: 14 }}>
          {list.error ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isLoading && !list.rows ? (
            <div className="catalogue-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="catalogue-card">
                  <Skeleton width="80%" height={16} />
                  <Skeleton width="50%" />
                  <Skeleton width="60%" />
                </div>
              ))}
            </div>
          ) : !list.rows?.length ? (
            <EmptyState
              icon={<LibraryBig />}
              title={filtered ? "No book matches" : "The catalogue is empty"}
              message={filtered ? "Try fewer words or another filter." : "Books appear here once the library adds them."}
            />
          ) : (
            <div className="catalogue-grid">
              {list.rows.map(b => (
                <Link key={b.id} to={`/library/catalogue/${b.id}`} className="catalogue-card">
                  <span className="catalogue-card-title" title={b.title}>
                    {b.title}
                  </span>
                  <span className="catalogue-card-meta" title={b.authors.join(", ")}>
                    {b.authors.join(", ") || "Author not recorded"}
                  </span>
                  <span className="catalogue-card-meta">{[b.category, b.shelfLocation && `Shelf ${b.shelfLocation}`].filter(Boolean).join(" · ") || " "}</span>
                  <span className="catalogue-card-foot">
                    <span className={b.availability.available ? "text-success" : "muted"}>{availabilityLine(b.availability)}</span>
                    {!b.canBeBorrowed && <Badge tone="warning">Not for loan</Badge>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={setPage} />}
      </Card>
    </Page>
  );
}
