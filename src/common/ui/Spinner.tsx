export function Spinner({ size = "md", label }: { size?: "md" | "lg"; label?: string }) {
  return <span className={`spinner${size === "lg" ? " spinner-lg" : ""}`} role="status" aria-label={label ?? "Loading"} />;
}

export function PageLoader({ label, full }: { label?: string; full?: boolean }) {
  return (
    <div className={`page-loader${full ? " full" : ""}`}>
      <Spinner size="lg" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14 }: { width?: number | string; height?: number }) {
  return <div className="skeleton" style={{ width, height }} />;
}

/* A few grey bars while a card or form loads */
export function SkeletonBlock({ lines = 4 }: { lines?: number }) {
  return (
    <div className="stack-sm">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${90 - (i % 3) * 18}%`} />
      ))}
    </div>
  );
}
