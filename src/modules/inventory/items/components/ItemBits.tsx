import { Badge } from "@/common/ui";
import type { Item } from "../api/items";

export function ItemStatus({ item }: { item: Pick<Item, "isLowStock" | "discontinued"> }) {
  if (item.discontinued) return <Badge>Discontinued</Badge>;
  if (item.isLowStock) return <Badge tone="danger">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}
