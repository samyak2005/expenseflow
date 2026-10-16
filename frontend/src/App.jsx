import { useState } from 'react';
import { createClaim, deleteClaim, updateClaimStatus } from './api.js';
import { formatMoney } from './format.js';
import useClaims from './hooks/useClaims.js';
import useDebouncedValue from './hooks/useDebouncedValue.js';
import useToast from './hooks/useToast.js';
import CategoryBreakdown from './components/CategoryBreakdown.jsx';
import ClaimsTable from './components/ClaimsTable.jsx';
import Header from './components/Header.jsx';
import KpiStrip from './components/KpiStrip.jsx';
import NewClaimModal from './components/NewClaimModal.jsx';
import RejectModal from './components/RejectModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

export default function App() {
  const [statusFilter, setStatusFilter] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);

  const { claims, stats, loading, error, reload } = useClaims({
    status: statusFilter,
    department,
    q: query,
  });

  const [toast, notify] = useToast();
  const [creating, setCreating] = useState(false);
  const [claimToReject, setClaimToReject] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function runClaimAction(claim, action, successMessage) {
    setBusyId(claim.id);
    try {
      await action();
      notify(successMessage);
      await reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const actions = {
    onApprove: (claim) =>
      runClaimAction(
        claim,
        () => updateClaimStatus(claim.id, 'APPROVED'),
        `Approved ${formatMoney(claim.amount)} for ${claim.employee_name}`,
      ),
    onMarkPaid: (claim) =>
      runClaimAction(
        claim,
        () => updateClaimStatus(claim.id, 'REIMBURSED'),
        `Marked ${formatMoney(claim.amount)} as paid`,
      ),
    onDelete: (claim) =>
      runClaimAction(claim, () => deleteClaim(claim.id), `Deleted "${claim.title}"`),
    onReject: setClaimToReject,
  };

  async function rejectClaim(reason) {
    await updateClaimStatus(claimToReject.id, 'REJECTED', reason);
    notify(`Rejected claim from ${claimToReject.employee_name}`);
    setClaimToReject(null);
    await reload();
  }

  async function submitClaim(claim) {
    const created = await createClaim(claim);
    setCreating(false);
    notify(`Claim #${created.id} submitted for approval`);
    await reload();
  }

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <Header
          search={search}
          onSearchChange={setSearch}
          onNewClaim={() => setCreating(true)}
          pendingCount={stats?.pending_count ?? 0}
        />

        {error && (
          <div className="error-banner" role="alert">
            <span>
              <strong>Could not load claims.</strong> {error}
            </span>
            <button type="button" className="btn btn-sm btn-outline" onClick={reload}>
              Retry
            </button>
          </div>
        )}

        <KpiStrip stats={stats} loading={loading} />

        <CategoryBreakdown byCategory={stats?.by_category} loading={loading} />

        <ClaimsTable
          claims={claims}
          stats={stats}
          loading={loading}
          busyId={busyId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          department={department}
          onDepartmentChange={setDepartment}
          actions={actions}
        />

        <footer className="app-footer">ExpenseFlow 1.0 · build {APP_VERSION.slice(0, 7)}</footer>
      </main>

      {creating && <NewClaimModal onClose={() => setCreating(false)} onSubmit={submitClaim} />}
      {claimToReject && (
        <RejectModal
          claim={claimToReject}
          onClose={() => setClaimToReject(null)}
          onConfirm={rejectClaim}
        />
      )}
      {toast && <Toast text={toast.text} type={toast.type} />}
    </div>
  );
}
