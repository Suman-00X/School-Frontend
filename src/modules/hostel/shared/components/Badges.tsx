import { Badge } from "@/common/ui";
import { GENDER_LABELS, PHASE_LABELS, PHASE_TONES, ROOM_STATUS_LABELS, ROOM_STATUS_TONES, type Phase, type ResidentGender, type RoomStatus } from "../utils/format";

export const PhaseBadge = ({ phase }: { phase: string }) => (
  <Badge tone={PHASE_TONES[phase as Phase] ?? "neutral"} dot>
    {PHASE_LABELS[phase as Phase] ?? phase}
  </Badge>
);

export const RoomStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={ROOM_STATUS_TONES[status as RoomStatus] ?? "neutral"} dot>
    {ROOM_STATUS_LABELS[status as RoomStatus] ?? status}
  </Badge>
);

export const GenderBadge = ({ gender }: { gender: string }) => (
  <Badge tone={gender === "BOYS" ? "info" : gender === "GIRLS" ? "primary" : "neutral"}>{GENDER_LABELS[gender as ResidentGender] ?? gender}</Badge>
);
