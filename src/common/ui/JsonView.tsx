export function JsonView({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <span className="muted">Nothing recorded</span>;
  return <pre className="json-view">{JSON.stringify(value, null, 2)}</pre>;
}
