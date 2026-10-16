import { formatMoney, pluralize } from '../format.js';

const EMPTY_STATS = {
  total_claims: 0,
  pending_count: 0,
  approved_count: 0,
  rejected_count: 0,
  reimbursed_count: 0,
  pending_amount: 0,
  approved_amount: 0,
  reimbursed_amount: 0,
};

function buildMetrics(stats) {
  return [
    {
      tone: 'pending',
      label: 'Pending approval',
      value: formatMoney(stats.pending_amount),
      detail: `${pluralize(stats.pending_count, 'claim')} to review`,
    },
    {
      tone: 'approved',
      label: 'Awaiting payout',
      value: formatMoney(stats.approved_amount),
      detail: `${pluralize(stats.approved_count, 'claim')} approved`,
    },
    {
      tone: 'reimbursed',
      label: 'Reimbursed',
      value: formatMoney(stats.reimbursed_amount),
      detail: `${pluralize(stats.reimbursed_count, 'claim')} paid out`,
    },
    {
      tone: 'rejected',
      label: 'Rejected',
      value: stats.rejected_count,
      detail: `of ${pluralize(stats.total_claims, 'claim')}`,
    },
  ];
}

export default function KpiStrip({ stats, loading }) {
  if (!stats && loading) {
    return (
      <section className="kpi-strip" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="kpi">
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-figure" />
            <div className="skeleton skeleton-text" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="kpi-strip">
      {buildMetrics(stats ?? EMPTY_STATS).map(({ tone, label, value, detail }) => (
        <div key={tone} className="kpi">
          <div className="kpi-label">
            <span className={`status-dot status-${tone}`} />
            {label}
          </div>
          <div className="kpi-value">{value}</div>
          <div className="kpi-detail">{detail}</div>
        </div>
      ))}
    </section>
  );
}
