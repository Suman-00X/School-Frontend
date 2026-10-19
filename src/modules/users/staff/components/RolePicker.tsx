import { Field } from "@/common/ui";
import { STAFF_ROLES, STAFF_ROLE_INFO } from "../api/staff";

/* Every staff role with a one-line description; the module manager roles read "Owner of …" */
export function RolePicker({ value, onChange, error }: { value: string; onChange: (role: string) => void; error?: string }) {
  return (
    <Field label="Role" required error={error} hint="The role can't be changed after the account is created.">
      <div className="stack-sm" role="radiogroup" aria-label="Role">
        {STAFF_ROLES.map(r => (
          <label key={r} className="check" style={{ alignItems: "flex-start" }}>
            <input type="radio" name="role" value={r} checked={value === r} onChange={() => onChange(r)} style={{ marginTop: 2 }} />
            <span>
              <span style={{ fontWeight: 550 }}>{STAFF_ROLE_INFO[r].label}</span>
              <span className="small muted"> · {STAFF_ROLE_INFO[r].description}</span>
            </span>
          </label>
        ))}
      </div>
    </Field>
  );
}
