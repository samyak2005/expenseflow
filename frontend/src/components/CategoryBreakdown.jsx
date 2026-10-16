import { formatMoney, formatPercent, humanize } from '../format.js';

export default function CategoryBreakdown({ byCategory, loading }) {
  const rows = (byCategory ?? [])
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Spend by category</h2>
        {total > 0 && <span className="panel-meta">{formatMoney(total)}</span>}
      </div>

      {loading && !byCategory && <div className="skeleton skeleton-bar" />}

      {!loading && rows.length === 0 && <p className="panel-empty">No spend recorded yet.</p>}

      {rows.length > 0 && (
        <>
          <div className="stacked-bar" role="img" aria-label="Share of spend by category">
            {rows.map((row) => (
              <span
                key={row.category}
                className={`stacked-segment category-${row.category.toLowerCase()}`}
                style={{ width: `${(row.amount / total) * 100}%` }}
                title={`${humanize(row.category)}: ${formatMoney(row.amount)}`}
              />
            ))}
          </div>

          <ul className="legend">
            {rows.map((row) => (
              <li key={row.category} className="legend-item">
                <span className={`legend-dot category-${row.category.toLowerCase()}`} />
                <span className="legend-name">{humanize(row.category)}</span>
                <span className="legend-amount">{formatMoney(row.amount)}</span>
                <span className="legend-share">{formatPercent(row.amount / total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
