import { Check } from "lucide-react";
import { Skeleton } from "@/common/ui";
import { LEVEL_COUNT, type ClassLevel, type LevelRow } from "../api/classes";

/* The fixed levels as a grid of options (always LEVEL_COUNT cells, so it never changes size).
   "one": pick a level for a class (radio); "many": tick the levels to create (checkbox).
   Levels another class already has are shown ticked and disabled. */
export function LevelPicker({
  levels,
  mode,
  value,
  onChange,
  own,
  disabled,
  label
}: {
  /* undefined while loading */
  levels: LevelRow[] | undefined;
  mode: "one" | "many";
  value: ClassLevel[];
  onChange: (next: ClassLevel[]) => void;
  /* Editing: the class's own level, which stays pickable */
  own?: ClassLevel | null;
  disabled?: boolean;
  label: string;
}) {
  if (!levels)
    return (
      <div className="level-grid" aria-busy="true" aria-label={label}>
        {Array.from({ length: LEVEL_COUNT }, (_, i) => (
          <div key={i} className="level-option is-placeholder">
            <Skeleton width="70%" />
          </div>
        ))}
      </div>
    );

  const toggle = (level: ClassLevel) => {
    if (mode === "one") return onChange([level]);
    onChange(value.includes(level) ? value.filter(l => l !== level) : [...value, level]);
  };

  return (
    <div className="level-grid" role={mode === "one" ? "radiogroup" : "group"} aria-label={label}>
      {levels.map(l => {
        const taken = l.created && l.level !== own;
        const checked = taken || value.includes(l.level);
        const off = disabled || taken;
        return (
          <label
            key={l.level}
            className={`level-option${checked ? " checked" : ""}${taken ? " taken" : ""}${off ? " disabled" : ""}`}
            title={taken ? `${l.className} already exists` : undefined}
          >
            <input
              type={mode === "one" ? "radio" : "checkbox"}
              name={mode === "one" ? "level" : undefined}
              checked={checked}
              disabled={off}
              onChange={() => toggle(l.level)}
            />
            <span className="level-name">{l.className}</span>
            <Check className="level-tick" aria-hidden />
          </label>
        );
      })}
    </div>
  );
}
