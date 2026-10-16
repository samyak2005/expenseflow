const TABS = [
  { value: '', label: 'All', countKey: 'total_claims' },
  { value: 'PENDING', label: 'Pending', countKey: 'pending_count' },
  { value: 'APPROVED', label: 'Approved', countKey: 'approved_count' },
  { value: 'REIMBURSED', label: 'Reimbursed', countKey: 'reimbursed_count' },
  { value: 'REJECTED', label: 'Rejected', countKey: 'rejected_count' },
];

export default function StatusTabs({ value, onChange, stats }) {
  return (
    <div className="tabs" role="tablist" aria-label="Filter by status">
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? 'tab tab-active' : 'tab'}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {stats && <span className="tab-count">{stats[tab.countKey]}</span>}
          </button>
        );
      })}
    </div>
  );
}
