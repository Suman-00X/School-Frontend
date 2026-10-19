import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useApiList, useApiMutation, useDebounce, useForm } from "@/common/hooks";
import { Badge, Button, Drawer, EmptyState, Field, SearchInput, Select, Skeleton, TextInput, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { CATALOGUE_PATH, MY_FINES_PATH, MY_HOLDS_PATH, placeHold, type CatalogueBook } from "../api/library";
import "../../shared/portal.css";

/* PO-07 · Reserve a book: search the catalogue, pick a title, optionally say until when it is
   needed. A parent says which child it is for (the API needs the child's account). */
export function ReserveDrawer({
  open,
  onClose,
  kids,
  defaultBorrower
}: {
  open: boolean;
  onClose: () => void;
  /* A parent's children (borrower account ids); empty for someone reserving for themselves */
  kids: { id: string; name: string }[];
  defaultBorrower?: string;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const query = useDebounce(q.trim(), 300);
  const [book, setBook] = useState<CatalogueBook | null>(null);
  const form = useForm({ notNeededAfter: "", borrowerUserId: defaultBorrower ?? "" });
  const books = useApiList<CatalogueBook>(CATALOGUE_PATH, { q: query || undefined, limit: 8 }, { enabled: open });
  const place = useApiMutation(placeHold, { invalidate: [MY_HOLDS_PATH, MY_FINES_PATH] });
  const forChild = kids.length > 0;

  const close = () => {
    setQ("");
    setBook(null);
    form.reset({ notNeededAfter: "", borrowerUserId: defaultBorrower ?? "" });
    onClose();
  };

  const submit = () => {
    form.setFormError(null);
    if (!book) return form.setFormError("Pick a book first.");
    if (forChild && !form.values.borrowerUserId) return form.setErrors({ borrowerUserId: "Choose who the book is for" });
    place.mutate(
      { bookId: book.id, notNeededAfter: form.values.notNeededAfter || undefined, borrowerUserId: forChild ? form.values.borrowerUserId : undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          close();
        },
        onError: e => form.setServerErrors(e)
      }
    );
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Reserve a book"
      subtitle="The library keeps the next free copy for you and lets you know when it is ready."
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={place.isPending} onClick={submit}>
            Reserve
          </Button>
        </>
      }
    >
      <div className="stack">
        {forChild && (
          <Select
            label="For"
            required
            placeholder="Choose a child"
            options={kids.map(k => ({ value: k.id, label: k.name }))}
            {...form.text("borrowerUserId")}
          />
        )}
        <Field label="Book" error={form.errors.bookId}>
          <SearchInput placeholder="Search by title, author or ISBN" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the catalogue" />
        </Field>
        <div className="po-book-results">
          {books.isLoading && !books.rows ? (
            [0, 1, 2, 3].map(i => <Skeleton key={i} height={52} />)
          ) : !books.rows?.length ? (
            <EmptyState icon={<BookOpen />} title={query ? "No books match" : "The catalogue is empty"} />
          ) : (
            books.rows.map(b => (
              <button
                key={b.id}
                type="button"
                className={`po-book${book?.id === b.id ? " is-selected" : ""}`}
                disabled={!b.canBeBorrowed}
                onClick={() => setBook(b)}
                aria-pressed={book?.id === b.id}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{b.title}</span>
                  <span className="small muted">{[b.authors.join(", "), b.category].filter(Boolean).join(" · ")}</span>
                </span>
                {!b.canBeBorrowed ? (
                  <Badge>Reference only</Badge>
                ) : b.availability.available > 0 ? (
                  <Badge tone="success">{b.availability.available} on the shelf</Badge>
                ) : (
                  <Badge tone="warning">{b.availability.holdsWaiting ? `${b.availability.holdsWaiting} waiting` : "All out"}</Badge>
                )}
              </button>
            ))
          )}
        </div>
        <TextInput
          label="Not needed after"
          type="date"
          min={todayIso()}
          hint="Optional. The reservation lapses after this date if no copy came back in time."
          {...form.text("notNeededAfter")}
        />
      </div>
    </Drawer>
  );
}
