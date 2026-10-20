import { useApiGet } from "@/common/hooks";
import { useAuth } from "@/common/auth";
import { Badge, Card } from "@/common/ui";
import { MY_DUTIES_PATH, type Duty } from "../api/substitutions";
import { dayName, hhmm } from "../utils/dates";
import "./substitutions.css";

type MyDuties = { teacherId: string; from: string; to: string; duties: Duty[] };

const what = (d: Duty) =>
  d.kind === "ACTIVITY" ? `${d.activity} (in charge)` : (d.subject ?? d.lessonSubject)?.subjectName ?? "";

/* Home, for teachers: the lessons they were asked to cover in the next 7 days (shown only when there are some) */
export function MyDutiesCard() {
  const { can, me, session } = useAuth();
  /* Self-service for teachers only (ADMIN holds the key but has no duties: the API says 403) */
  const enabled = can("academics.substitutions.mine") && (me?.role ?? session?.user.role) === "TEACHER";
  const { data } = useApiGet<MyDuties>(MY_DUTIES_PATH, undefined, { enabled });
  if (!enabled || !data?.duties.length) return null;
  return (
    <Card title="Your substitutions" subtitle="Lessons you cover for absent teachers" flush>
      <ul className="cover-duties">
        {data.duties.map(d => (
          <li key={d.id}>
            <Badge tone={d.date === data.from ? "warning" : "neutral"}>{dayName(d.date, data.from)}</Badge>
            <span>
              <strong>{d.period.name}</strong> <span className="small muted">{hhmm(d.period.startTime)}–{hhmm(d.period.endTime)}</span>
            </span>
            <span>
              {d.section.name} · {what(d)}
            </span>
            <span className="small muted">for {d.absentTeacher.name}{d.note ? ` · ${d.note}` : ""}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
