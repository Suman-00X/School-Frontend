import { forwardRef, type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from "react";
import { ScanBarcode } from "lucide-react";
import { Badge, Select } from "@/common/ui";
import type { CopyStatus, HoldStatus, ItemType, LoanStatus } from "../api/types";
import { useBookOptions, useBorrowers, type Borrower } from "../hooks/useLibraryLookups";
import {
  COPY_STATUS_LABELS,
  COPY_STATUS_TONES,
  HOLD_STATUS_LABELS,
  HOLD_STATUS_TONES,
  ITEM_TYPE_LABELS,
  LOAN_STATUS_LABELS,
  LOAN_STATUS_TONES
} from "../utils/labels";
import "../library.css";

/* The top of a page whose name is already the active header tab or side item: a one-line
   description and the page's actions, no title. Always the height of a button. */
export function LibraryIntro({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row-between" style={{ minHeight: 34, flexWrap: "nowrap", gap: 12 }}>
      <p
        className="muted"
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={typeof children === "string" ? children : undefined}
      >
        {children}
      </p>
      {actions && <div className="row" style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export const CopyStatusBadge = ({ status }: { status: CopyStatus }) => (
  <Badge tone={COPY_STATUS_TONES[status]} dot>
    {COPY_STATUS_LABELS[status]}
  </Badge>
);

export const LoanStatusBadge = ({ status, overdue }: { status: LoanStatus; overdue?: boolean }) =>
  overdue && status === "ISSUED" ? (
    <Badge tone="danger" dot>
      Overdue
    </Badge>
  ) : (
    <Badge tone={LOAN_STATUS_TONES[status]} dot>
      {LOAN_STATUS_LABELS[status]}
    </Badge>
  );

export const HoldStatusBadge = ({ status }: { status: HoldStatus }) => (
  <Badge tone={HOLD_STATUS_TONES[status]} dot>
    {HOLD_STATUS_LABELS[status]}
  </Badge>
);

/* Reference items are never lent: they say so */
export const ItemTypeBadge = ({ type }: { type: ItemType }) =>
  type === "REFERENCE" ? <Badge tone="warning">Not for loan</Badge> : <Badge>{ITEM_TYPE_LABELS[type]}</Badge>;

/* A row of small figures (On loan 2 · Overdue 1 · Fines ₹14) */
export function StatChips({ items }: { items: { label: string; value: ReactNode; tone?: "danger" | "warning" | "success" }[] }) {
  return (
    <div className="lib-stats">
      {items.map(i => (
        <div key={i.label} className={`lib-stat${i.tone ? ` lib-stat-${i.tone}` : ""}`}>
          <span className="lib-stat-label">{i.label}</span>
          <span className="lib-stat-value">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

/* The scanner's field: a barcode scanner types the code and presses Enter */
export const ScanInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { onScan: (code: string) => void }>(function ScanInput(
  { onScan, className, ...rest },
  ref
) {
  return (
    <div className={`input-group${className ? " " + className : ""}`}>
      <ScanBarcode className="icon-left" />
      <input
        ref={ref}
        type="text"
        className="input has-icon-left mono"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        {...rest}
        onKeyDown={e => {
          rest.onKeyDown?.(e);
          if (e.key === "Enter") {
            e.preventDefault();
            const code = e.currentTarget.value.trim();
            if (code) onScan(code);
          }
        }}
      />
    </div>
  );
});

/* Pick a borrower (student or employee) by name; the value is their account id */
export function BorrowerSelect({
  label = "Borrower",
  value,
  onChange,
  known,
  placeholder,
  required,
  error,
  hint,
  className,
  disabled
}: {
  label?: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  known?: Borrower[];
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { options, isLoading } = useBorrowers(known);
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      placeholder={isLoading ? "Loading borrowers…" : (placeholder ?? "Search by name")}
      required={required}
      error={error}
      hint={hint}
      className={className}
      disabled={disabled}
    />
  );
}

/* Pick a title from the catalogue */
export function BookSelect({
  label = "Book",
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  className,
  disabled
}: {
  label?: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { options, isLoading } = useBookOptions();
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      placeholder={isLoading ? "Loading books…" : (placeholder ?? "Search by title, author or ISBN")}
      required={required}
      error={error}
      hint={hint}
      className={className}
      disabled={disabled}
    />
  );
}
