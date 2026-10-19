import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

type Contact = { name: string | null; phone: string | null } | null;

export type MyTransport = {
  student: { id: string; studentCode: string; firstName: string; lastName: string };
  transport: {
    assignmentId: string;
    direction: "BOTH" | "PICKUP_ONLY" | "DROP_ONLY";
    startDate: string;
    endDate: string | null;
    route: { id: string; name: string; code: string };
    stop: { id: string; name: string; sequence: number; landmark: string | null; pickupTime: string | null; dropTime: string | null; monthlyFee: number | null };
    vehicle: { registrationNumber: string; make: string | null; model: string | null; status: string } | null;
    driver: Contact;
    attendant: Contact;
  } | null;
};

export type HostelStay = {
  id: string;
  phase: "CURRENT" | "UPCOMING" | string;
  fromDate: string;
  toDate: string | null;
  bedNumber: number;
  hostel: { id: string; name: string; code: string; address: string | null; contactPhone: string | null };
  room: { id: string; roomNumber: string; floor: number | null; roomType: string | null; monthlyFee: number | null; status: string };
  warden: Contact;
};

export type MyHostel = {
  student: { id: string; studentCode: string; name: string };
  current: HostelStay | null;
  upcoming: HostelStay[];
  resources: {
    id: string;
    phase: string;
    fromDate: string;
    toDate: string | null;
    withBed: boolean;
    resource: { id: string; name: string; resourceType: string; customType: string | null; monthlyFee: number | null };
  }[];
};

/* Both return every child of the caller at once: loaded once and kept while switching children */
export function useMyTransport() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/transport/my-transport"],
    enabled: can("transport.myTransport.read"),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.get<MyTransport[]>("/transport/my-transport", undefined, { signal })).data
  });
}

export function useMyHostel() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/hostel/my-hostel"],
    enabled: can("hostel.myHostel.read"),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.get<MyHostel[]>("/hostel/my-hostel", undefined, { signal })).data
  });
}
