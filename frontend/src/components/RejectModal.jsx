import { useState } from 'react';
import Field from './Field.jsx';
import Modal from './Modal.jsx';
import { formatMoney } from '../format.js';

const MIN_REASON_LENGTH = 3;

export default function RejectModal({ claim, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Add a reason of at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Reject claim"
      description={`${claim.title} · ${claim.employee_name} · ${formatMoney(claim.amount)}`}
      onClose={onClose}
      size="sm"
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && <div className="form-error">{error}</div>}
        <Field label="Reason">
          <textarea
            autoFocus
            rows={3}
            placeholder="e.g. Receipt missing, please resubmit"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={saving}>
            {saving ? 'Rejecting...' : 'Reject claim'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
