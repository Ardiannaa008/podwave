// Reusable layout component - takes a label prop and renders whatever
// form control is passed in as children. Used across the Create page.
export default function FieldGroup({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      {children}
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
    </div>
  );
}
