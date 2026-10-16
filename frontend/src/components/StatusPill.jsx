import { STATUS_LABELS } from '../format.js';

export default function StatusPill({ status }) {
  return (
    <span className={`pill status-${status.toLowerCase()}`}>
      <span className="pill-dot" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
