import BrandMark from './BrandMark.jsx';
import Icon from './Icon.jsx';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', active: true },
  { label: 'My claims', icon: 'receipt' },
  { label: 'Approvals', icon: 'check-circle' },
  { label: 'Reports', icon: 'bar-chart' },
  { label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <span className="brand-name">ExpenseFlow</span>
      </div>

      <nav className="nav" aria-label="Main">
        {NAV_ITEMS.map(({ label, icon, active }) => (
          <button
            key={label}
            type="button"
            className={active ? 'nav-item nav-item-active' : 'nav-item'}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="profile">
        <span className="profile-avatar" aria-hidden="true">
          FT
        </span>
        <div>
          <div className="profile-name">Finance team</div>
          <div className="profile-role">Admin</div>
        </div>
      </div>
    </aside>
  );
}
