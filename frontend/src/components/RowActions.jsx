import { useState } from 'react';

export default function RowActions({ claim, busy, onApprove, onReject, onMarkPaid, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deletable = claim.status === 'PENDING' || claim.status === 'REJECTED';

  if (confirmingDelete) {
    return (
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-sm btn-danger"
          disabled={busy}
          onClick={() => onDelete(claim)}
        >
          Confirm delete
        </button>
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          onClick={() => setConfirmingDelete(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="row-actions">
      {claim.status === 'PENDING' && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-approve"
            disabled={busy}
            onClick={() => onApprove(claim)}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn btn-sm btn-quiet-danger"
            disabled={busy}
            onClick={() => onReject(claim)}
          >
            Reject
          </button>
        </>
      )}
      {claim.status === 'APPROVED' && (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={busy}
          onClick={() => onMarkPaid(claim)}
        >
          Mark paid
        </button>
      )}
      {deletable && (
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      )}
      {claim.status === 'REIMBURSED' && <span className="row-closed">Closed</span>}
    </div>
  );
}
