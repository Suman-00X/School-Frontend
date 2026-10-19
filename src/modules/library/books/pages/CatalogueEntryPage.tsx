/* LB-03 · Catalogue (browse view): one title, its copies and when they are due back */
import { useParams } from "react-router-dom";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Card, DataTable, DescriptionList, EmptyState, ErrorState, Page, SkeletonBlock } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { CopyStatusBadge, ItemTypeBadge } from "../../shared/components/LibraryBits";
import { ITEM_TYPE_LABELS } from "../../shared/utils/labels";
import { useCatalogueEntry } from "../api/books";
import { availabilityLine } from "./CataloguePage";

export default function CatalogueEntryPage() {
  const { bookId = "" } = useParams();
  const q = useCatalogueEntry(bookId);
  const b = q.data;
  const header = (
    <DrillHeader
      back="/library/catalogue"
      backLabel="Back to the catalogue"
      title={
        <span style={{ display: "inline-block", width: "min(320px, 50vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={b?.title}>
          {b?.title ?? "Book"}
        </span>
      }
    />
  );
  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  return (
    <Page>
      {header}
      <Card>
        {!b ? (
          <SkeletonBlock lines={6} />
        ) : (
          <div className="stack">
            <div className="row" style={{ gap: 8 }}>
              <ItemTypeBadge type={b.itemType} />
              {b.category && <Badge>{b.category}</Badge>}
              {!b.canBeBorrowed && b.itemType !== "REFERENCE" && <Badge tone="warning">Not for loan</Badge>}
              <span className={b.availability.available ? "text-success" : "muted"}>{availabilityLine(b.availability)}</span>
            </div>
            <DescriptionList
              columns={3}
              items={[
                { label: "Authors", value: b.authors.join(", ") },
                { label: "Subtitle", value: b.subtitle, hidden: !b.subtitle },
                { label: "Shelf", value: b.shelfLocation },
                { label: "Subject", value: b.subject?.subjectName },
                { label: "ISBN", value: b.isbn && <span className="mono">{b.isbn}</span> },
                { label: "Publisher", value: [b.publisher, b.publishedYear].filter(Boolean).join(", ") },
                { label: "Edition", value: b.edition, hidden: !b.edition },
                { label: "Language", value: b.language },
                { label: "About", value: b.description, wide: true, hidden: !b.description }
              ]}
            />
          </div>
        )}
      </Card>
      <Card flush title="Copies">
        <DataTable
          rows={b?.copies}
          rowKey={c => c.accessionNumber}
          loading={!b}
          empty={<EmptyState title="No copies yet" />}
          columns={[
            { key: "accessionNumber", header: "Copy", render: c => <span className="mono">{c.accessionNumber}</span> },
            { key: "status", header: "Status", render: c => <CopyStatusBadge status={c.status} /> },
            { key: "itemType", header: "Type", render: c => ITEM_TYPE_LABELS[c.itemType] },
            { key: "dueDate", header: "Due back", render: c => (c.dueDate ? formatDate(c.dueDate) : <span className="muted">—</span>) }
          ]}
        />
      </Card>
    </Page>
  );
}
