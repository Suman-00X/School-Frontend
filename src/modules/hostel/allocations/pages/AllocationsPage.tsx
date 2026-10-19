import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarSync, Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Button, ButtonLink, Card, Page, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { AllocateDrawer, type AllocatePrefill } from "../components/AllocateDrawer";
import { AllocationDrawer } from "../components/AllocationDrawer";
import { AllocationList } from "../components/AllocationList";
import { AvailabilityView } from "../components/AvailabilityView";
import { BedBoard } from "../components/BedBoard";

const PATH = "/hostel/allocations";

/* HO-02 · Bed allocations: bed board, list and availability share the allocation drawer and the
   Allocate drawer. /hostel/allocations/:allocationId opens one allocation; ?new=1 opens Allocate. */
export default function AllocationsPage() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams();
  const [search, setSearch] = useSearchParams();
  const canManage = can("hostel.allocations.manage");

  const tabs: TabItem[] = [
    { id: "board", label: "Bed board", hidden: !can("hostel.hostels.read") },
    { id: "list", label: "List" },
    { id: "availability", label: "Availability" }
  ];
  const [view, setView] = useTabParam(tabs, "view");

  /* Allocate: ?new=1, with its prefill in the query (room, bed, dates) */
  const allocating = canManage && search.get("new") === "1";
  const prefill: AllocatePrefill = {
    roomId: search.get("roomId") ?? undefined,
    bedNumber: search.get("bed") ? Number(search.get("bed")) : undefined,
    fromDate: search.get("from") ?? undefined,
    toDate: search.get("to") ?? undefined
  };
  const setAllocating = (p: AllocatePrefill | null) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        for (const k of ["new", "roomId", "bed", "from", "to"]) next.delete(k);
        if (p) {
          next.set("new", "1");
          if (p.roomId) next.set("roomId", p.roomId);
          if (p.bedNumber) next.set("bed", String(p.bedNumber));
          if (p.fromDate) next.set("from", p.fromDate);
          if (p.toDate) next.set("to", p.toDate);
        }
        return next;
      },
      { replace: true }
    );

  const openAllocation = (id: string | null) => {
    const qs = new URLSearchParams(location.search);
    for (const k of ["new", "roomId", "bed", "from", "to"]) qs.delete(k);
    navigate({ pathname: id ? `${PATH}/${id}` : PATH, search: qs.toString() });
  };

  return (
    <Page>
      <PageIntro
        actions={
          canManage && (
            <>
              {!readOnly && (
                <ButtonLink icon={<CalendarSync />} to={`${PATH}/rollover`}>
                  Year-end roll-over
                </ButtonLink>
              )}
              <Button variant="primary" icon={<Plus />} onClick={() => setAllocating({})}>
                Allocate bed
              </Button>
            </>
          )
        }
      >
        Who sleeps where, by date: current stays, bookings ahead, and beds free for a stay.
      </PageIntro>
      <Tabs tabs={tabs} value={view} onChange={setView} />
      {view === "board" && <BedBoard onOpen={openAllocation} onAllocate={setAllocating} />}
      {view === "list" && (
        <Card flush>
          <AllocationList onOpen={openAllocation} />
        </Card>
      )}
      {view === "availability" && <AvailabilityView onBook={setAllocating} />}
      <AllocateDrawer open={allocating} prefill={prefill} onClose={() => setAllocating(null)} onDone={a => openAllocation(a.id)} />
      <AllocationDrawer id={allocationId ?? null} onClose={() => openAllocation(null)} onOpen={openAllocation} />
    </Page>
  );
}
