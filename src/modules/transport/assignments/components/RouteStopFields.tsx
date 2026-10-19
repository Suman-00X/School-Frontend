import { useMemo } from "react";
import { Select, type Option } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { timesLabel } from "../../shared/utils/format";
import { seatsFreeLabel, useAllRoutes, type TransportRoute } from "../../routes/api/routes";

/* Route (with seats free in the year) and stop (with times and fee) for assigning or changing a seat.
   Full routes and routes without a vehicle can't be picked, except `keepRouteId` (a change of stop
   on the student's own route frees their seat first). */
export function RouteStopFields({
  routeId,
  stopId,
  onRoute,
  onStop,
  errors,
  keepRouteId,
  disabled
}: {
  routeId: string;
  stopId: string;
  onRoute: (routeId: string) => void;
  onStop: (stopId: string) => void;
  errors: { routeId?: string; stopId?: string };
  keepRouteId?: string;
  disabled?: boolean;
}) {
  const currency = useSchoolCurrency();
  const routes = useAllRoutes();
  const route: TransportRoute | undefined = routes.rows?.find(r => r.id === routeId);

  const routeOptions = useMemo<Option[]>(
    () =>
      (routes.rows ?? []).map(r => {
        const full = r.occupancy.capacity === null || (r.occupancy.available ?? 0) <= 0;
        return {
          value: r.id,
          label: `${r.code} · ${r.name}`,
          description: r.occupancy.capacity !== null && r.occupancy.available === 0 ? `Full (${r.occupancy.assigned} of ${r.occupancy.capacity} seats)` : seatsFreeLabel(r.occupancy),
          disabled: full && r.id !== keepRouteId
        };
      }),
    [routes.rows, keepRouteId]
  );

  const stopOptions = useMemo<Option[]>(
    () =>
      [...(route?.stops ?? [])]
        .sort((a, b) => a.sequence - b.sequence)
        .map(s => ({
          value: s.id,
          label: `${s.sequence}. ${s.name}`,
          description: [timesLabel(s.pickupTime, s.dropTime), s.monthlyFee ? `${formatMoney(s.monthlyFee, currency)} a month` : null, s.landmark]
            .filter(Boolean)
            .join(" · ")
        })),
    [route, currency]
  );

  return (
    <>
      <Select
        label="Route"
        required
        value={routeId}
        onChange={e => onRoute(e.target.value)}
        options={routeOptions}
        placeholder={routes.isLoading ? "Loading routes…" : "Pick a route"}
        error={errors.routeId}
        hint={route ? seatsFreeLabel(route.occupancy) + (route.occupancy.yearName ? ` in ${route.occupancy.yearName}` : "") : "Seats free are counted in the selected year"}
        disabled={disabled}
      />
      <Select
        label="Stop"
        required
        value={stopId}
        onChange={e => onStop(e.target.value)}
        options={stopOptions}
        placeholder={route ? "Pick a stop" : "Pick a route first"}
        error={errors.stopId}
        hint="Pickup / drop times and the monthly fee"
        disabled={disabled || !route}
      />
    </>
  );
}
