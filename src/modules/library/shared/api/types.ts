/* Shapes returned by /api/v1/library (typed from the backend's services and checked against the demo API) */

export type ItemType = "BOOK" | "REFERENCE" | "PERIODICAL" | "MEDIA";
export type LoanableItemType = Exclude<ItemType, "REFERENCE">;
export type CopyStatus = "AVAILABLE" | "ISSUED" | "ON_HOLD" | "LOST" | "DAMAGED" | "WITHDRAWN" | "MISSING";
export type ManualCopyStatus = "AVAILABLE" | "LOST" | "DAMAGED" | "WITHDRAWN" | "MISSING";
export type LoanStatus = "ISSUED" | "RETURNED" | "LOST";
export type ReturnCondition = "OK" | "DAMAGED" | "LOST";
export type FineMethod = "CASH" | "UPI" | "CARD" | "LIBRARY_CREDIT";
export type HoldStatus = "WAITING" | "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED";
export type FineDayBasis = "ACADEMIC_DAYS" | "CALENDAR_DAYS";
export type StockCheckStatus = "OPEN" | "CLOSED";
export type ScanResult = "FOUND" | "UNEXPECTED" | "UNKNOWN";

type Stamped = { id: string; createdAt: string; updatedAt: string };

/* GET /library/policy */
export type LibraryPolicy = Stamped & {
  blockOnFines: boolean;
  fineBlockThreshold: number | null;
  blockOnOverdue: boolean;
  fineDayBasis: FineDayBasis;
  capFineAtPrice: boolean;
  lostProcessingFee: number;
  lostMinimumCharge: number;
  lostIncludesLateFine: boolean;
  lostFoundRefundDays: number;
  holdPickupDays: number;
  maxHoldsPerBorrower: number;
  dueSoonDays: number;
  overdueReminderEveryDays: number;
  notifyParents: boolean;
  /* Fields the school still has to set, e.g. ["fineBlockThreshold"] */
  setupNeeded: string[];
};

/* GET /library/circulation-rules */
export type CirculationRule = Stamped & {
  borrowerRole: string | null;
  classId: string | null;
  itemType: LoanableItemType | null;
  loanDays: number;
  maxLoans: number;
  maxRenewals: number;
  finePerDay: number;
  fineGraceDays: number;
  maxFine: number | null;
  class: { id: string; className: string } | null;
  /* "students of Class 6 borrowing books" */
  appliesTo: string;
};

/* GET /library/closures */
export type Closure = Stamped & { fromDate: string; toDate: string; reason: string; createdBy: string };

export type CopyCounts = {
  total: number;
  available: number;
  issued: number;
  onHold: number;
  lost: number;
  damaged: number;
  withdrawn: number;
  missing: number;
};

/* GET /library/books (staff view) */
export type Book = Stamped & {
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  edition: string | null;
  language: string | null;
  category: string | null;
  itemType: ItemType;
  subjectId: string | null;
  shelfLocation: string | null;
  description: string | null;
  internalNotes: string | null;
  subject: { id: string; subjectName: string } | null;
  copies: CopyCounts;
  holdsWaiting: number;
};

export type BookInput = {
  title: string;
  subtitle?: string | null;
  authors?: string[];
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  edition?: string | null;
  language?: string | null;
  category?: string | null;
  itemType?: ItemType;
  subjectId?: string | null;
  shelfLocation?: string | null;
  description?: string | null;
  internalNotes?: string | null;
};

export type Availability = { total: number; available: number; onLoan: number; onHold: number; holdsWaiting: number };

/* GET /library/catalogue (browse view: no prices, sources or notes) */
export type CatalogueEntry = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  edition: string | null;
  language: string | null;
  category: string | null;
  itemType: ItemType;
  subject: { id: string; subjectName: string } | null;
  shelfLocation: string | null;
  description: string | null;
  availability: Availability;
  canBeBorrowed: boolean;
  /* GET /library/catalogue/:bookId only */
  copies?: { accessionNumber: string; status: CopyStatus; itemType: ItemType; dueDate?: string | null }[];
};

/* GET /library/copies, /library/books/:bookId/copies */
export type Copy = Stamped & {
  bookId: string;
  accessionNumber: string;
  barcode: string | null;
  status: CopyStatus;
  /* null: the book's own type */
  itemType: ItemType | null;
  price: number | null;
  acquiredOn: string | null;
  source: string | null;
  conditionNotes: string | null;
  book?: { id: string; title: string; authors: string[]; isbn: string | null; shelfLocation: string | null; itemType: ItemType };
};

export type BorrowerRef = { id: string; firstName: string; lastName: string; role: string; name: string };

export type FinePayment = {
  id: string;
  receiptNumber: string;
  amount: number;
  method: FineMethod;
  /* Not in the borrower account's list */
  reference?: string | null;
  paidAt: string;
  loanId?: string;
  /* The borrower account's list only */
  title?: string;
};

export type FineWaiver = { id: string; amount: number; reason: string; waivedAt: string };

/* GET /library/loans, /library/loans/:loanId */
export type Loan = Stamped & {
  copyId: string;
  bookId: string;
  borrowerUserId: string;
  borrowerRole: string;
  itemType: ItemType;
  ruleId: string | null;
  /* Terms copied from the rule at issue */
  loanDays: number;
  maxRenewals: number;
  finePerDay: number;
  fineGraceDays: number;
  fineCap: number | null;
  issuedOn: string;
  dueDate: string;
  returnedOn: string | null;
  lostOn: string | null;
  foundOn: string | null;
  status: LoanStatus;
  returnCondition: ReturnCondition | null;
  returnNotes: string | null;
  renewalCount: number;
  lateFine: number;
  lostCharge: number;
  damageCharge: number;
  lostChargeReversed: number;
  finePaid: number;
  fineWaived: number;
  fineCredited: number;
  fineOutstanding: number;
  backdateReason: string | null;
  blockOverrideReason: string | null;
  copy: { id: string; accessionNumber: string; barcode: string | null; status: CopyStatus };
  book: { id: string; title: string; authors: string[]; isbn: string | null };
  borrower: BorrowerRef;
  fineTotal: number;
  /* false while the book is out: the late fine still grows */
  fineIsFinal: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  /* GET /library/loans/:loanId only */
  payments?: FinePayment[];
  waivers?: FineWaiver[];
  /* POST …/recovery only */
  found?: { reversed: number; credited: number; daysLost: number; refundDays: number };
};

export type Block = { reason: "OVERDUE" | "FINES" | string; message: string };

/* GET /library/borrowers/:userId/account */
export type BorrowerAccount = {
  borrower: { id: string; name: string; role: string; status: string };
  openLoans: number;
  overdueLoans: number;
  finesOutstanding: number;
  credit: number;
  canBorrow: boolean;
  blocks: Block[];
  loansWithFines: {
    loanId: string;
    title: string;
    accessionNumber: string;
    status: LoanStatus;
    dueDate: string;
    lateFine: number;
    lostCharge: number;
    damageCharge: number;
    finePaid: number;
    fineWaived: number;
    fineOutstanding: number;
  }[];
  payments: FinePayment[];
  credits: { id: string; amount: number; reason: string; createdAt: string; loanId?: string | null }[];
};

/* GET /library/holds */
export type Hold = Stamped & {
  bookId: string;
  borrowerUserId: string;
  status: HoldStatus;
  requestedAt: string;
  notNeededAfter: string | null;
  copyId: string | null;
  readyOn: string | null;
  pickupBy: string | null;
  fulfilledLoanId: string | null;
  closedAt: string | null;
  closedReason: string | null;
  book: { id: string; title: string; authors: string[]; itemType: ItemType };
  copy: { id: string; accessionNumber: string } | null;
  borrower: BorrowerRef;
  /* Waiting holds only */
  queuePosition: number | null;
};

export type StockCheckSummary = { expected: number; found: number; missing: number; unexpected: number; unknown: number };

/* GET /library/stock-checks */
export type StockCheck = Stamped & {
  title: string;
  notes: string | null;
  status: StockCheckStatus;
  startedOn: string;
  closedOn: string | null;
  expectedCount: number | null;
  foundCount: number | null;
  missingCount: number | null;
  unexpectedCount: number | null;
  /* GET /library/stock-checks/:id only */
  summary?: StockCheckSummary;
};

export type ScanOutcome = {
  code: string;
  result: ScanResult;
  repeated: boolean;
  accessionNumber: string | null;
  title: string | null;
  copyStatus: CopyStatus | null;
};

/* GET …/missing */
export type MissingCopy = {
  id: string;
  bookId: string;
  accessionNumber: string;
  barcode: string | null;
  status: CopyStatus;
  /* Open checks: from the book; closed checks list copies (with book) */
  title?: string;
  shelfLocation?: string | null;
  book?: { title: string; shelfLocation?: string | null };
};

/* GET …/unexpected */
export type UnexpectedScan = {
  id: string;
  code: string;
  result: ScanResult;
  copyStatus: CopyStatus | null;
  scannedAt?: string;
  createdAt?: string;
  copy: { id: string; accessionNumber: string; status: CopyStatus; book: { id: string; title: string } | null } | null;
};
