import { MoreHorizontal } from "lucide-react";
import { Button, Menu, MenuItem } from "@/common/ui";
import type { LoanAction } from "./LoanActions";

/* A table row's loan actions: the first as a small button, the rest in a menu */
export function LoanRowMenu({ actions, label }: { actions: LoanAction[]; label: string }) {
  if (!actions.length) return null;
  const [first, ...rest] = actions;
  return (
    <div className="row-actions" onClick={e => e.stopPropagation()}>
      <Button size="sm" variant="ghost" icon={first.icon} onClick={first.run}>
        {first.label}
      </Button>
      {rest.length > 0 && (
        <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${label}`} title="More" />}>
          {close =>
            rest.map(a => (
              <MenuItem
                key={a.id}
                icon={a.icon}
                danger={a.danger}
                onClick={() => {
                  close();
                  a.run();
                }}
              >
                {a.label}
              </MenuItem>
            ))
          }
        </Menu>
      )}
    </div>
  );
}
