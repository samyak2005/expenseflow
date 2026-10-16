import Icon from './Icon.jsx';
import { formatLongDate } from '../format.js';

export default function Header({ search, onSearchChange, onNewClaim, pendingCount }) {
  return (
    <header className="page-header">
      <div>
        <h1>Expense claims</h1>
        <p className="page-subtitle">
          {formatLongDate(new Date())}
          {pendingCount > 0 && <span> · {pendingCount} awaiting review</span>}
        </p>
      </div>

      <div className="page-actions">
        <label className="search">
          <Icon name="search" className="search-icon" />
          <input
            type="search"
            placeholder="Search employee or expense"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search claims"
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={onNewClaim}>
          <Icon name="plus" />
          New claim
        </button>
      </div>
    </header>
  );
}
