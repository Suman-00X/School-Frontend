import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

type Borrower = { id: string; firstName?: string; lastName?: string; role?: string; name: string };

export type Loan = {
  id: string;
  bookId: string;
  borrowerUserId: string;
  issuedOn: string;
  dueDate: string;
  returnedOn: string | null;
  status: "ISSUED" | "RETURNED" | "LOST";
  renewalCount: number;
  maxRenewals: number;
  fineOutstanding: number;
  fineTotal: number;
  fineIsFinal: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  copy: { id: string; accessionNumber: string } | null;
  book: { id: string; title: string; authors: string[]; isbn: string | null };
  borrower: Borrower;
};

export type Hold = {
  id: string;
  bookId: string;
  borrowerUserId: string;
  status: "WAITING" | "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED";
  requestedAt: string;
  notNeededAfter: string | null;
  readyOn: string | null;
  pickupBy: string | null;
  queuePosition: number | null;
  closedReason: string | null;
  book: { id: string; title: string; authors: string[]; itemType: string };
  copy: { id: string; accessionNumber: string } | null;
  borrower: Borrower;
};

export type LibraryAccount = {
  borrower: { id: string; name: string; role: string; status: string };
  openLoans: number;
  overdueLoans: number;
  finesOutstanding: number;
  credit: number;
  canBorrow: boolean;
  blocks: { reason: string; message: string }[];
  loansWithFines: {
    loanId: string;
    title: string;
    accessionNumber: string;
    status: string;
    dueDate: string;
    lateFine: number;
    lostCharge: number;
    damageCharge: number;
    finePaid: number;
    fineWaived: number;
    fineOutstanding: number;
  }[];
  payments: { id: string; loanId: string; amount: number; method: string; receiptNumber: string; paidAt: string; title: string }[];
  credits: { id: string; amount: number; reason: string; createdAt: string }[];
};

export type CatalogueBook = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  category: string | null;
  itemType: string;
  shelfLocation: string | null;
  availability: { total: number; available: number; onLoan: number; onHold: number; holdsWaiting: number };
  canBeBorrowed: boolean;
};

export const MY_LOANS_PATH = "/library/my-loans";
export const MY_HOLDS_PATH = "/library/my-holds";
export const MY_FINES_PATH = "/library/my-fines";
export const CATALOGUE_PATH = "/library/catalogue";

/* One account for the caller, or one per child for a parent: also how a parent's children
   are known here (the borrower ids that holds need) */
export function useMyLibraryAccounts() {
  const { can } = useAuth();
  return useQuery({
    queryKey: [MY_FINES_PATH],
    enabled: can("library.loans.readOwn"),
    queryFn: async ({ signal }) => (await api.get<LibraryAccount[]>(MY_FINES_PATH, undefined, { signal })).data
  });
}

export const placeHold = (body: { bookId: string; notNeededAfter?: string; borrowerUserId?: string }) => api.post<Hold>(MY_HOLDS_PATH, body);
export const cancelHold = (holdId: string) => api.post<Hold>(`${MY_HOLDS_PATH}/${holdId}/cancellation`, {});

export const HOLD_STATUS_LABELS: Record<Hold["status"], string> = {
  WAITING: "Waiting",
  READY: "Ready to collect",
  FULFILLED: "Collected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};
export const HOLD_STATUS_TONES = { WAITING: "info", READY: "success", FULFILLED: "neutral", CANCELLED: "neutral", EXPIRED: "neutral" } as const;
export const LOAN_STATUS_LABELS: Record<Loan["status"], string> = { ISSUED: "On loan", RETURNED: "Returned", LOST: "Lost" };
