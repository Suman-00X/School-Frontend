import { Checkbox, Field } from "@/common/ui";
import { CHANNEL_META, CHANNELS, SMS_COST_NOTE, type Channel } from "../utils/channels";

/* In-app (always on, locked), Email and SMS. The SMS cost note sits in the field's reserved line. */
export function ChannelPicker({ value, onChange, error, disabled }: { value: Channel[]; onChange: (next: Channel[]) => void; error?: string | null; disabled?: boolean }) {
  const toggle = (c: Channel) => onChange(value.includes(c) ? value.filter(v => v !== c) : [...value, c]);
  return (
    <Field label="Send by" hint={value.includes("SMS") ? SMS_COST_NOTE : "Everyone gets it in their inbox. Email and SMS are extra."} error={error}>
      <div className="row" role="group" aria-label="Channels" style={{ gap: 18, minHeight: 34 }}>
        {CHANNELS.map(c => {
          const Icon = CHANNEL_META[c].icon;
          return (
            <Checkbox
              key={c}
              checked={c === "IN_APP" || value.includes(c)}
              disabled={disabled || c === "IN_APP"}
              onChange={() => toggle(c)}
              title={c === "IN_APP" ? "Always on" : undefined}
              label={
                <span className="row" style={{ gap: 5 }}>
                  <Icon size={15} className="muted" />
                  {CHANNEL_META[c].label}
                </span>
              }
            />
          );
        })}
      </div>
    </Field>
  );
}

/* Channel icons for a table cell */
export function ChannelIcons({ channels }: { channels: string[] }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      {CHANNELS.filter(c => channels.includes(c)).map(c => {
        const Icon = CHANNEL_META[c].icon;
        return (
          <span key={c} title={CHANNEL_META[c].label} aria-label={CHANNEL_META[c].label} className="muted" style={{ display: "inline-flex" }}>
            <Icon size={15} />
          </span>
        );
      })}
    </span>
  );
}
