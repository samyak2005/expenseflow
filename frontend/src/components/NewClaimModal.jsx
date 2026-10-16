import { useState } from 'react';
import Field from './Field.jsx';
import Modal from './Modal.jsx';
import { CATEGORIES, DEPARTMENTS, humanize, todayIso } from '../format.js';

const MAX_AMOUNT = 1000000;

const initialForm = () => ({
  employee_name: '',
  department: 'ENGINEERING',
  title: '',
  category: 'TRAVEL',
  amount: '',
  expense_date: todayIso(),
  description: '',
});

function validate(form) {
  const errors = {};
  const amount = Number(form.amount);

  if (!form.employee_name.trim()) errors.employee_name = 'Enter the employee name';
  if (!form.title.trim()) errors.title = 'Describe the expense';
  if (!form.amount || Number.isNaN(amount) || amount <= 0)
    errors.amount = 'Enter an amount above zero';
  else if (amount > MAX_AMOUNT) errors.amount = 'Amount cannot exceed ₹10,00,000';
  if (!form.expense_date) errors.expense_date = 'Pick a date';
  else if (form.expense_date > todayIso()) errors.expense_date = 'Date cannot be in the future';

  return errors;
}

function toPayload(form) {
  return {
    ...form,
    employee_name: form.employee_name.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    amount: Number(form.amount),
  };
}

export default function NewClaimModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const bind = (field) => ({
    value: form[field],
    onChange: (event) => setForm((current) => ({ ...current, [field]: event.target.value })),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSubmitError('');
    try {
      await onSubmit(toPayload(form));
    } catch (err) {
      setSubmitError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New expense claim"
      description="It goes to the finance team for approval."
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {submitError && <div className="form-error">{submitError}</div>}

        <div className="form-row">
          <Field label="Employee" error={errors.employee_name}>
            <input autoFocus placeholder="e.g. Priya Sharma" {...bind('employee_name')} />
          </Field>
          <Field label="Department">
            <select {...bind('department')}>
              {DEPARTMENTS.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Expense" error={errors.title}>
          <input
            maxLength={200}
            placeholder="e.g. Cab to client office in Whitefield"
            {...bind('title')}
          />
        </Field>

        <div className="form-row">
          <Field label="Category">
            <select {...bind('category')}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₹)" error={errors.amount}>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              placeholder="0.00"
              {...bind('amount')}
            />
          </Field>
          <Field label="Date" error={errors.expense_date}>
            <input type="date" max={todayIso()} {...bind('expense_date')} />
          </Field>
        </div>

        <Field label="Notes" optional>
          <textarea
            rows={3}
            placeholder="Receipt number, client, trip details"
            {...bind('description')}
          />
        </Field>

        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit claim'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
