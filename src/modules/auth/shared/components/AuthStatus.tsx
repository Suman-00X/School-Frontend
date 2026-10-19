import { Link } from "react-router-dom";

export type Problem = { message: string; offerReset?: boolean };

/* A reserved two-line slot under an auth form: messages appear here without moving anything */
export function AuthStatus({ problem, tone = "danger" }: { problem: Problem | null; tone?: "danger" | "warning" }) {
  return (
    <div className={`auth-status auth-status-${tone}`} role={problem ? "alert" : undefined}>
      {problem?.message}
      {problem?.offerReset && (
        <>
          {" "}
          <Link to="/forgot-password">Reset password</Link>
        </>
      )}
    </div>
  );
}
