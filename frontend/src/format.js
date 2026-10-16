export const DEPARTMENTS = ['ENGINEERING', 'SALES', 'MARKETING', 'HR', 'FINANCE', 'OPERATIONS'];
export const CATEGORIES = ['TRAVEL', 'MEALS', 'SOFTWARE', 'EQUIPMENT', 'TRAINING', 'OTHER'];

export const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REIMBURSED: 'Reimbursed',
  REJECTED: 'Rejected',
};

const currencyFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const formatMoney = (amount) => currencyFormat.format(Number(amount) || 0);

export const formatPercent = (ratio) => percentFormat.format(ratio);

export const humanize = (value) =>
  value.length > 2 ? value.charAt(0) + value.slice(1).toLowerCase() : value;

export const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// new Date('2026-10-14') parses as UTC midnight and can render as the previous day locally.
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const formatLongDate = (date) =>
  date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
