import RowActions from './RowActions.jsx';
import StatusPill from './StatusPill.jsx';
import { formatDate, formatMoney, humanize, initials } from '../format.js';

export default function ClaimRow({ claim, busy, actions }) {
  const category = humanize(claim.category);
  const date = formatDate(claim.expense_date);

  return (
    <tr className={busy ? 'row-busy' : undefined}>
      <td className="cell-employee">
        <div className="employee">
          <span className="avatar" aria-hidden="true">
            {initials(claim.employee_name)}
          </span>
          <div>
            <div className="employee-name">{claim.employee_name}</div>
            <div className="employee-department">{humanize(claim.department)}</div>
          </div>
        </div>
      </td>
      <td className="cell-expense">
        <div className="claim-title">{claim.title}</div>
        <div className="claim-meta">
          {category} · {date}
        </div>
        {claim.reviewer_comment && <div className="claim-note">{claim.reviewer_comment}</div>}
      </td>
      <td className="col-category cell-muted">{category}</td>
      <td className="col-date cell-muted cell-nowrap">{date}</td>
      <td className="cell-amount cell-end amount">{formatMoney(claim.amount)}</td>
      <td className="cell-status">
        <StatusPill status={claim.status} />
      </td>
      <td className="cell-actions cell-end">
        <RowActions claim={claim} busy={busy} {...actions} />
      </td>
    </tr>
  );
}
