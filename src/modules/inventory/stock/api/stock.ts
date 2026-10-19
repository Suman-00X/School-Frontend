import { api } from "@/common/api";
import { personName, type MovementType } from "../../shared/utils/format";

export const MOVEMENTS_PATH = "/inventory/movements";

type PersonRef = { id: string; firstName: string; lastName: string; role: string };

export type Movement = {
  id: string;
  movementNumber: string;
  movementDate: string;
  type: MovementType;
  itemId: string;
  /* Signed: +5 received, −2 issued */
  quantityChange: number;
  balanceAfter: number;
  unitCost: number;
  totalValue: number;
  averageCostAfter: number;
  vendorId: string | null;
  issuedToUserId: string | null;
  issuedTo: string | null;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  item: { id: string; sku: string; name: string; unit: string; stockOnHand: number; averageUnitCost: number } | null;
  vendor: { id: string; name: string } | null;
  issuedToUser: PersonRef | null;
  creator: PersonRef | null;
};

export type MovementInput = {
  type: MovementType;
  quantity?: number;
  quantityChange?: number;
  unitCost?: number;
  vendorId?: string;
  issuedToUserId?: string;
  issuedTo?: string;
  reason?: string;
  reference?: string;
  movementDate?: string;
};

export const recordMovement = ({ itemId, ...body }: MovementInput & { itemId: string }) => api.post<Movement>(`/inventory/items/${itemId}/movements`, body);

/* Vendor for receipts, the person or place for issues and returns */
export const counterparty = (m: Movement) => (m.type === "RECEIPT" ? (m.vendor?.name ?? null) : personName(m.issuedToUser) || m.issuedTo);
