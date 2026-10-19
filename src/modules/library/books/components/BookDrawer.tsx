import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Button, ButtonLink, Drawer, Select, TagInput, TextInput, Textarea, useToast } from "@/common/ui";
import type { Book, BookInput, ItemType } from "../../shared/api/types";
import { useBookOptions, useSubjectOptions } from "../../shared/hooks/useLibraryLookups";
import { itemTypeOptions } from "../../shared/utils/labels";
import { useCreateBook, useUpdateBook } from "../api/books";

type Values = {
  title: string;
  subtitle: string;
  isbn: string;
  publisher: string;
  publishedYear: string;
  edition: string;
  language: string;
  category: string;
  itemType: ItemType;
  subjectId: string;
  shelfLocation: string;
  description: string;
  internalNotes: string;
};

const EMPTY: Values = {
  title: "",
  subtitle: "",
  isbn: "",
  publisher: "",
  publishedYear: "",
  edition: "",
  language: "",
  category: "",
  itemType: "BOOK",
  subjectId: "",
  shelfLocation: "",
  description: "",
  internalNotes: ""
};

const toValues = (b: Book): Values => ({
  title: b.title,
  subtitle: b.subtitle ?? "",
  isbn: b.isbn ?? "",
  publisher: b.publisher ?? "",
  publishedYear: b.publishedYear ? String(b.publishedYear) : "",
  edition: b.edition ?? "",
  language: b.language ?? "",
  category: b.category ?? "",
  itemType: b.itemType,
  subjectId: b.subjectId ?? "",
  shelfLocation: b.shelfLocation ?? "",
  description: b.description ?? "",
  internalNotes: b.internalNotes ?? ""
});

/* Free-text fields: the API takes "" to clear them (never null) */
const TEXT = ["subtitle", "publisher", "edition", "language", "shelfLocation", "description", "internalNotes"] as const;

const LANGUAGES = ["English", "Hindi", "Kannada", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Malayalam", "Urdu", "Sanskrit", "French", "German"];

/* LB-03 book form: new title (book = null) or edit one */
export function BookDrawer({ open, book, onClose }: { open: boolean; book: Book | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm<Values>(EMPTY);
  const [authors, setAuthors] = useState<string[]>([]);
  const [isbnClash, setIsbnClash] = useState<string | null>(null);
  const create = useCreateBook();
  const update = useUpdateBook();
  const { categories } = useBookOptions(open);
  const subjects = useSubjectOptions();
  const { values, errors } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(book ? toValues(book) : EMPTY);
    setAuthors(book?.authors ?? []);
    setIsbnClash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "is required";
    const year = values.publishedYear.trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) > new Date().getFullYear() + 1)) e.publishedYear = "must be a year such as 2019";
    if (book && !year && book.publishedYear) e.publishedYear = "can be changed but not removed";
    if (book && !values.category.trim() && book.category) e.category = "can be changed but not removed";
    if (values.isbn.trim() && !/^[0-9Xx\s-]{10,17}$/.test(values.isbn.trim())) e.isbn = "must be an ISBN-10 or ISBN-13";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const bodyOf = (): BookInput => {
    const body: BookInput = { title: values.title.trim(), authors, itemType: values.itemType };
    for (const k of TEXT) body[k] = values[k].trim();
    body.isbn = values.isbn.trim() || null;
    if (values.publishedYear.trim()) body.publishedYear = Number(values.publishedYear);
    if (values.category.trim()) body.category = values.category.trim();
    body.subjectId = values.subjectId || null;
    return body;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /ISBN/i.test(err.message)) {
      setIsbnClash(values.isbn.replace(/[\s-]/g, ""));
      form.setErrors({ isbn: err.message });
      form.setFormError(null);
      return;
    }
    form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    setIsbnClash(null);
    if (!validate()) return form.setFormError("Please correct the highlighted fields.");
    const body = bodyOf();
    if (!book) {
      /* POST: leave out empty optional texts */
      for (const k of TEXT) if (!body[k]) delete body[k];
      if (!body.isbn) delete body.isbn;
      if (!body.subjectId) delete body.subjectId;
      create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`/library/books/${res.data.id}`);
        },
        onError
      });
      return;
    }
    const before = { ...toValues(book) };
    const changes: Partial<BookInput> = {};
    if (body.title !== book.title) changes.title = body.title;
    if (authors.join("\n") !== book.authors.join("\n")) changes.authors = authors;
    if (body.itemType !== book.itemType) changes.itemType = body.itemType;
    for (const k of TEXT) if (body[k] !== before[k]) changes[k] = body[k];
    const isbnNow = values.isbn.replace(/[\s-]/g, "").toUpperCase() || null;
    if (isbnNow !== (book.isbn ?? null)) changes.isbn = body.isbn;
    if (body.publishedYear && body.publishedYear !== book.publishedYear) changes.publishedYear = body.publishedYear;
    if (body.category && body.category !== book.category) changes.category = body.category;
    if ((body.subjectId ?? null) !== (book.subjectId ?? null)) changes.subjectId = body.subjectId;
    if (!Object.keys(changes).length) return onClose();
    update.mutate(
      { id: book.id, ...changes },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError
      }
    );
  };

  const busy = create.isPending || update.isPending;
  const categoryOptions = categories.map(c => ({ value: c, label: c }));
  const languageOptions = [...new Set([...LANGUAGES, ...(values.language ? [values.language] : [])])].map(l => ({ value: l, label: l }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={book ? `Edit ${book.title}` : "New book"}
      footerStatus={
        isbnClash ? (
          <span>
            That ISBN is already in the catalogue.{" "}
            <ButtonLink variant="link" to={`/library/books?q=${encodeURIComponent(isbnClash)}`} onClick={onClose}>
              Open it
            </ButtonLink>
          </span>
        ) : (
          form.formError
        )
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="book-form" variant="primary" loading={busy}>
            {book ? "Save changes" : "Add book"}
          </Button>
        </>
      }
    >
      <form id="book-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Title" required autoFocus maxLength={300} fieldClassName="span-2" {...form.text("title")} />
          <TextInput label="Subtitle" maxLength={300} fieldClassName="span-2" {...form.text("subtitle")} />
          <TagInput
            label="Authors"
            value={authors}
            onChange={setAuthors}
            max={20}
            maxLength={200}
            placeholder="Type a name and press Enter"
            hint="Up to 20; Enter or a comma adds one"
            error={errors.authors}
            fieldClassName="span-2"
          />
          <TextInput label="ISBN" maxLength={17} inputMode="numeric" placeholder="978-…" {...form.text("isbn")} hint="Hyphens and spaces are removed" />
          <Select
            label="Item type"
            {...form.text("itemType")}
            onChange={e => form.set("itemType", e.target.value as ItemType)}
            options={itemTypeOptions()}
            hint={values.itemType === "REFERENCE" ? "Reference items are never lent" : "A copy can have its own type"}
          />
          <Select
            label="Category"
            creatable
            {...form.text("category")}
            placeholder="Pick or type a category"
            options={categoryOptions}
            hint="e.g. Fiction, Science, Biography"
          />
          <Select label="Subject" {...form.text("subjectId")} placeholder="No subject" options={subjects} hint="Links the book to a school subject" />
          <TextInput label="Shelf" maxLength={50} placeholder="e.g. F-4" {...form.text("shelfLocation")} />
          <Select label="Language" creatable {...form.text("language")} placeholder="Pick or type" options={languageOptions} />
          <TextInput label="Publisher" maxLength={200} {...form.text("publisher")} />
          <div className="form-grid" style={{ gap: "0 12px" }}>
            <TextInput label="Year" inputMode="numeric" maxLength={4} placeholder="2019" {...form.text("publishedYear")} />
            <TextInput label="Edition" maxLength={50} placeholder="2nd" {...form.text("edition")} />
          </div>
          <Textarea label="Description" rows={3} maxLength={2000} fieldClassName="span-2" {...form.text("description")} hint="Shown in the catalogue" />
          <Textarea label="Staff notes" rows={2} maxLength={2000} fieldClassName="span-2" {...form.text("internalNotes")} hint="Only library staff see these" />
        </div>
      </form>
    </Drawer>
  );
}
