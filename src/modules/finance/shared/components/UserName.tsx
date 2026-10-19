import { useAuth } from "@/common/auth";
import { usePersonById } from "@/modules/administration";

/* Who did something (assignedBy, grantedBy, updatedBy are user ids): "You", the employee's name
   when the person may list staff and teachers, else a dash with the id on hover */
export function UserName({ id }: { id: string | null | undefined }) {
  const { me } = useAuth();
  const person = usePersonById(id);
  if (!id) return <span className="muted">—</span>;
  if (id === me?.account.id) return <>You</>;
  if (person && !person.name.startsWith("User ")) return <>{person.name}</>;
  return (
    <span className="muted" title={`User ${id}`}>
      Staff member
    </span>
  );
}
