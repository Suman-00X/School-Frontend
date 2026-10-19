import type { ReactNode } from "react";
import { initials } from "@/common/utils/format";

export function Avatar({ name, src, size }: { name: string; src?: string | null; size?: "md" | "lg" }) {
  return (
    <span className={`avatar${size === "lg" ? " avatar-lg" : ""}`} aria-hidden>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

/* Name with a second line (email, code) for table cells */
export function PersonCell({ name, sub, avatar = true, extra }: { name: string; sub?: ReactNode; avatar?: boolean; extra?: ReactNode }) {
  return (
    <div className="person">
      {avatar && <Avatar name={name} />}
      <div style={{ minWidth: 0 }}>
        <div className="person-name">
          {name} {extra}
        </div>
        {sub && <div className="person-sub">{sub}</div>}
      </div>
    </div>
  );
}
