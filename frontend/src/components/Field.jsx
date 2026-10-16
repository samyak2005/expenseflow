export default function Field({ label, optional = false, error, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional && <span className="field-optional">Optional</span>}
      </span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
