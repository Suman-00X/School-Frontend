import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "./charts.css";

/* Plain SVG/CSS charts, drawn with the design tokens so they read in day and night mode.
   - <ColumnChart>  columns over categories, one or more series side by side (months, classes)
   - <LineChart>    a line (with an optional area wash) over an ordered x axis (days)
   - <BarList>      horizontal bars with the value at the tip (sections, methods, subjects)
   - <StackedBar>   parts of a whole in one bar (delivery: sent, pending, failed)
   - <StatTile>     a KPI: label, value, hint, optional meter; same height loading or loaded
   - <Legend>       series keys; always shown for two or more series
   Series colours: seriesColor(0..3), in that order (never cycled). Pass a token for a status. */

export const seriesColor = (index: number) => `var(--chart-${Math.min(index, 3) + 1})`;

export type ChartSeries = { key: string; label: string; color?: string };

const colorOf = (s: ChartSeries, i: number) => s.color ?? seriesColor(i);

const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compactFmt.format(n);

/* A clean upper bound and four ticks: 0 … max */
function niceScale(maxValue: number, ticks = 4) {
  if (!(maxValue > 0)) return { max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = maxValue / ticks;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const max = step * Math.ceil(maxValue / step);
  const out: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return { max, step, ticks: out };
}

/* The element's width, kept up to date */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => setWidth(Math.floor(entries[0]!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* A path for a column with a rounded top (4px) and a square base */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

type TooltipRow = { label: ReactNode; value: ReactNode; color?: string };

function ChartTooltip({ x, y, width, title, rows, note }: { x: number; y: number; width: number; title: ReactNode; rows: TooltipRow[]; note?: ReactNode }) {
  /* Flips to the left of the pointer near the right edge */
  const flip = x > width - 200;
  return (
    <div className="chart-tooltip" style={{ top: Math.max(0, y), ...(flip ? { right: width - x + 12 } : { left: x + 12 }) }} role="status">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="chart-tooltip-row">
          {r.color && <span className="chart-tooltip-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
      {note && <div className="chart-tooltip-note">{note}</div>}
    </div>
  );
}

export function Legend({ items }: { items: { label: ReactNode; color: string; shape?: "rect" | "line"; value?: ReactNode }[] }) {
  return (
    <div className="chart-legend">
      {items.map((it, i) => (
        <span key={i} className="chart-legend-item">
          <span className={`chart-legend-swatch${it.shape === "line" ? " is-line" : ""}`} style={{ background: it.color }} />
          {it.label}
          {it.value !== undefined && <span className="chart-legend-value">{it.value}</span>}
        </span>
      ))}
    </div>
  );
}

function ChartEmpty({ height, children }: { height: number; children?: ReactNode }) {
  return (
    <div className="chart-empty" style={{ height }}>
      {children ?? "No data for this range"}
    </div>
  );
}

/* Keyboard: left and right move the highlighted category, Escape clears it */
function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => (a === null ? 0 : Math.min(count - 1, a + 1)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => (a === null ? count - 1 : Math.max(0, a - 1)));
    } else if (e.key === "Escape") setActive(null);
  };
  return { active, setActive, onKeyDown };
}

const AXIS_FONT = 11;
const tickWidth = (labels: string[]) => Math.max(...labels.map(l => l.length), 1) * 6.5 + 10;

/* Every n-th x label so they don't collide */
const labelEvery = (count: number, plotWidth: number, longest: number) => Math.max(1, Math.ceil((count * (longest * 6.5 + 12)) / Math.max(plotWidth, 1)));

export type ColumnDatum = { label: string; values: Record<string, number | null | undefined>; note?: ReactNode };

/* Columns over categories. Several series stand side by side in each category (2px apart). */
export function ColumnChart({
  data,
  series,
  height = 220,
  formatValue = v => v.toLocaleString(),
  formatTick = formatCompact,
  ariaLabel,
  empty
}: {
  data: ColumnDatum[];
  series: ChartSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  formatTick?: (v: number) => string;
  ariaLabel: string;
  empty?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, setActive, onKeyDown } = useActiveIndex(data.length);
  const max = Math.max(0, ...data.flatMap(d => series.map(s => d.values[s.key] ?? 0)));
  const scale = niceScale(max);
  const tickLabels = scale.ticks.map(formatTick);
  const left = tickWidth(tickLabels);
  const top = 8;
  const bottom = 24;
  const plotW = Math.max(0, width - left - 4);
  const plotH = height - top - bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, (band * 0.7 - (series.length - 1) * 2) / series.length));
  const groupW = barW * series.length + (series.length - 1) * 2;
  const y = (v: number) => top + plotH - (v / scale.max) * plotH;
  const every = labelEvery(data.length, plotW, Math.max(...data.map(d => d.label.length), 1));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - left) / band);
    setActive(i >= 0 && i < data.length ? i : null);
  };

  if (!data.length) return <ChartEmpty height={height}>{empty}</ChartEmpty>;
  const hovered = active !== null ? data[active] : null;

  return (
    <div
      ref={ref}
      className={`chart${active !== null ? " is-hovering" : ""}`}
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
          {scale.ticks.map((t, i) => (
            <g key={t}>
              <line className={t === 0 ? "chart-baseline" : "chart-grid"} x1={left} x2={left + plotW} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
              <text className="chart-tick" x={left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = left + i * band;
            const gx = x0 + (band - groupW) / 2;
            return (
              <g key={d.label + i}>
                <rect className={`chart-band${active === i ? " is-active" : ""}`} x={x0} y={top} width={band} height={plotH} />
                {series.map((s, si) => {
                  const v = d.values[s.key] ?? 0;
                  const h = y(0) - y(v);
                  return <path key={s.key} className={`chart-bar${active === i ? " is-active" : ""}`} d={columnPath(gx + si * (barW + 2), y(v), barW, h)} fill={colorOf(s, si)} />;
                })}
                {i % every === 0 && (
                  <text className="chart-tick" x={x0 + band / 2} y={height - 6} textAnchor="middle" fontSize={AXIS_FONT}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && active !== null && (
        <ChartTooltip
          x={left + active * band + band / 2}
          y={top}
          width={width}
          title={hovered.label}
          note={hovered.note}
          rows={series.map((s, si) => ({ label: s.label, value: hovered.values[s.key] == null ? "—" : formatValue(hovered.values[s.key]!), color: colorOf(s, si) }))}
        />
      )}
    </div>
  );
}

export type LineDatum = { x: string; label: string; values: Record<string, number | null | undefined>; note?: ReactNode };

/* A line per series over an ordered x axis, with a crosshair that snaps to the nearest point
   and one tooltip listing every series there. `area` adds a light wash under the first series. */
export function LineChart({
  data,
  series,
  height = 220,
  domain,
  area,
  formatValue = v => v.toLocaleString(),
  formatTick = formatCompact,
  ariaLabel,
  empty
}: {
  data: LineDatum[];
  series: ChartSeries[];
  height?: number;
  /* Fixed y range, e.g. [0, 100] for percentages; default 0 … a clean max */
  domain?: [number, number];
  area?: boolean;
  formatValue?: (v: number) => string;
  formatTick?: (v: number) => string;
  ariaLabel: string;
  empty?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradientId = useId();
  const { active, setActive, onKeyDown } = useActiveIndex(data.length);
  const max = Math.max(0, ...data.flatMap(d => series.map(s => d.values[s.key] ?? 0)));
  const scale = domain ? { min: domain[0], max: domain[1], ticks: Array.from({ length: 5 }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / 4) } : { min: 0, ...niceScale(max) };
  const tickLabels = scale.ticks.map(formatTick);
  const left = tickWidth(tickLabels);
  const top = 8;
  const bottom = 24;
  const right = 8;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const x = (i: number) => left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => top + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;

  const onMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!data.length) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left - left;
      const i = data.length <= 1 ? 0 : Math.round((px / Math.max(plotW, 1)) * (data.length - 1));
      setActive(Math.max(0, Math.min(data.length - 1, i)));
    },
    [data.length, left, plotW, setActive]
  );

  if (!data.length) return <ChartEmpty height={height}>{empty}</ChartEmpty>;

  /* Ticks along x: about one per 90px, always the first and last */
  const xTicks = (() => {
    const n = Math.max(2, Math.floor(plotW / 90));
    const step = Math.max(1, Math.ceil((data.length - 1) / (n - 1)));
    const out: number[] = [];
    for (let i = 0; i < data.length; i += step) out.push(i);
    if (out[out.length - 1] !== data.length - 1) {
      if (out.length > 1 && data.length - 1 - out[out.length - 1]! < step / 2) out.pop();
      out.push(data.length - 1);
    }
    return out;
  })();

  const pathOf = (key: string) => {
    let d = "";
    let open = false;
    data.forEach((p, i) => {
      const v = p.values[key];
      if (v === null || v === undefined) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(i)},${y(v)}`;
      open = true;
    });
    return d;
  };

  const areaOf = (key: string) => {
    const pts = data.map((p, i) => ({ i, v: p.values[key] })).filter(p => p.v !== null && p.v !== undefined) as { i: number; v: number }[];
    if (pts.length < 2) return "";
    return `M${x(pts[0]!.i)},${y(scale.min)}${pts.map(p => `L${x(p.i)},${y(p.v)}`).join("")}L${x(pts[pts.length - 1]!.i)},${y(scale.min)}Z`;
  };

  const hovered = active !== null ? data[active] : null;
  const last = data.length - 1;

  return (
    <div ref={ref} className="chart" style={{ height }} tabIndex={0} role="img" aria-label={ariaLabel} onKeyDown={onKeyDown} onBlur={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={series[0] ? colorOf(series[0], 0) : "transparent"} stopOpacity="0.16" />
              <stop offset="1" stopColor={series[0] ? colorOf(series[0], 0) : "transparent"} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {scale.ticks.map((t, i) => (
            <g key={t}>
              <line className={i === 0 ? "chart-baseline" : "chart-grid"} x1={left} x2={left + plotW} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
              <text className="chart-tick" x={left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {xTicks.map(i => (
            <text key={i} className="chart-tick" x={x(i)} y={height - 6} textAnchor={i === 0 && data.length > 1 ? "start" : i === last && data.length > 1 ? "end" : "middle"}>
              {data[i]!.label}
            </text>
          ))}
          {area && series[0] && <path d={areaOf(series[0].key)} fill={`url(#${CSS.escape(gradientId)})`} />}
          {series.map((s, si) => (
            <path key={s.key} d={pathOf(s.key)} fill="none" stroke={colorOf(s, si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* End dots carry the latest value's position */}
          {series.map((s, si) => {
            const v = data[last]!.values[s.key];
            return v === null || v === undefined ? null : <circle key={s.key} className="chart-dot" cx={x(last)} cy={y(v)} r={4} fill={colorOf(s, si)} />;
          })}
          {hovered && active !== null && (
            <>
              <line className="chart-crosshair" x1={Math.round(x(active)) + 0.5} x2={Math.round(x(active)) + 0.5} y1={top} y2={top + plotH} />
              {series.map((s, si) => {
                const v = hovered.values[s.key];
                return v === null || v === undefined ? null : <circle key={s.key} className="chart-dot" cx={x(active)} cy={y(v)} r={4} fill={colorOf(s, si)} />;
              })}
            </>
          )}
        </svg>
      )}
      {hovered && active !== null && (
        <ChartTooltip
          x={x(active)}
          y={top}
          width={width}
          title={hovered.label}
          note={hovered.note}
          rows={series.map((s, si) => ({ label: s.label, value: hovered.values[s.key] == null ? "—" : formatValue(hovered.values[s.key]!), color: colorOf(s, si) }))}
        />
      )}
    </div>
  );
}

export type BarListItem = {
  key: string;
  label: string;
  value: number | null;
  /* Shown in place of the formatted value at the tip */
  display?: ReactNode;
  /* Extra line in the tooltip */
  note?: ReactNode;
  to?: string;
  color?: string;
};

/* Horizontal bars: the label on the left, the value at the bar's tip. A `mark` draws a dashed
   reference line (a threshold). One series, so no legend: the card title names it. */
export function BarList({
  items,
  max,
  mark,
  formatValue = v => v.toLocaleString(),
  color = seriesColor(0),
  ariaLabel,
  empty
}: {
  items: BarListItem[];
  max?: number;
  mark?: { value: number; label: string };
  formatValue?: (v: number) => string;
  color?: string;
  ariaLabel: string;
  empty?: ReactNode;
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (!items.length) return <ChartEmpty height={120}>{empty}</ChartEmpty>;
  const top = max ?? Math.max(1, ...items.map(i => i.value ?? 0));
  return (
    <div className="hbars" role="list" aria-label={ariaLabel}>
      {items.map(it => {
        const body = (
          <>
            <span className="hbar-label" title={it.label}>
              {it.label}
            </span>
            <span className="hbar-track">
              {/* The fill's share of the track leaves room for the value at its tip */}
              <span className="hbar-fill" style={{ width: it.value ? `calc((100% - 64px) * ${(it.value ?? 0) / top})` : 0, background: it.color ?? color }} />
              <span className="hbar-value">{it.display ?? (it.value === null ? "—" : formatValue(it.value))}</span>
              {mark && <span className="hbar-mark" style={{ left: `calc((100% - 64px) * ${Math.min(1, mark.value / top)})` }} title={mark.label} />}
            </span>
            {hover === it.key && it.note && (
              <div className="chart-tooltip" style={{ top: "100%", left: "30%" }} role="status">
                <div className="chart-tooltip-title">{it.label}</div>
                <div className="chart-tooltip-note">{it.note}</div>
              </div>
            )}
          </>
        );
        const handlers = {
          onPointerEnter: () => setHover(it.key),
          onPointerLeave: () => setHover(h => (h === it.key ? null : h)),
          onFocus: () => setHover(it.key),
          onBlur: () => setHover(h => (h === it.key ? null : h))
        };
        return it.to ? (
          <Link key={it.key} to={it.to} className="hbar" role="listitem" {...handlers}>
            {body}
          </Link>
        ) : (
          <div key={it.key} className="hbar" role="listitem" tabIndex={it.note ? 0 : undefined} {...handlers}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* Parts of a whole in one bar; the legend under it carries the counts */
export function StackedBar({
  segments,
  ariaLabel,
  legend = true
}: {
  segments: { key: string; label: string; value: number; color: string }[];
  ariaLabel: string;
  legend?: boolean;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="stack-sm">
      <div className="stacked-bar" role="img" aria-label={`${ariaLabel}: ${segments.map(s => `${s.label} ${s.value}`).join(", ")}`}>
        {total > 0 &&
          segments
            .filter(s => s.value > 0)
            .map(s => <span key={s.key} className="stacked-bar-segment" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />)}
      </div>
      {legend && <Legend items={segments.map(s => ({ label: s.label, color: s.color, value: s.value }))} />}
    </div>
  );
}

export type StatTone = "primary" | "success" | "warning" | "danger";

/* A KPI tile. Every state has the same lines, so a row of tiles never changes height:
   label · value · hint, plus a meter (0-100) when `meter` is passed (even null). */
export function StatTile({
  label,
  value,
  hint,
  hintTone,
  meter,
  meterTone = "primary",
  loading,
  title
}: {
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  hintTone?: "good" | "bad" | "warn";
  meter?: number | null;
  meterTone?: StatTone;
  loading?: boolean;
  title?: string;
}) {
  return (
    <div className="stat-tile" title={title}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{loading ? <span className="skeleton" style={{ width: "45%" }} /> : value}</div>
      <div className={`stat-tile-hint${hintTone && !loading ? ` is-${hintTone}` : ""}`}>{loading ? <span className="skeleton" style={{ width: "70%" }} /> : hint}</div>
      {meter !== undefined && (
        <div className={`meter tone-${meterTone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter ?? undefined}>
          <div className="meter-fill" style={{ width: `${loading || meter === null ? 0 : Math.max(0, Math.min(100, meter))}%` }} />
        </div>
      )}
    </div>
  );
}

/* A row of tiles that wraps (auto-fit, ≥170px each) */
export function StatTiles({ children }: { children: ReactNode }) {
  return <div className="stat-tiles">{children}</div>;
}
