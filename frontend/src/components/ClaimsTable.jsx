import ClaimRow from './ClaimRow.jsx';
import Icon from './Icon.jsx';
import StatusTabs from './StatusTabs.jsx';
import { DEPARTMENTS, humanize } from '../format.js';

const COLUMNS = [
  { label: 'Employee' },
  { label: 'Expense' },
  { label: 'Category', className: 'col-category' },
  { label: 'Date', className: 'col-date' },
  { label: 'Amount', className: 'cell-end' },
  { label: 'Status' },
  { label: 'Actions', className: 'cell-end' },
];

export default function ClaimsTable({
  claims,
  stats,
  loading,
  busyId,
  statusFilter,
  onStatusFilterChange,
  department,
  onDepartmentChange,
  actions,
}) {
  const showSkeleton = loading && claims.length === 0;
  const showEmpty = !loading && claims.length === 0;

  return (
    <section className="panel claims-panel">
      <div className="panel-header panel-header-wrap">
        <h2>Claims</h2>
        <div className="claims-filters">
          <StatusTabs value={statusFilter} onChange={onStatusFilterChange} stats={stats} />
          <select
            className="select"
            value={department}
            onChange={(event) => onDepartmentChange(event.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showSkeleton && (
        <div className="table-skeleton" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton skeleton-row" />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="receipt" size={22} />
          </span>
          <p className="empty-title">No claims match these filters</p>
          <p className="empty-text">Try another status or department, or submit a new claim.</p>
        </div>
      )}

      {claims.length > 0 && (
        <table className="claims-table">
          <thead>
            <tr>
              {COLUMNS.map(({ label, className }) => (
                <th key={label} className={className}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} busy={busyId === claim.id} actions={actions} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
