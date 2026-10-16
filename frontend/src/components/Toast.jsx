import Icon from './Icon.jsx';

export default function Toast({ text, type }) {
  return (
    <div className={`toast toast-${type}`} role="status">
      <Icon name={type === 'error' ? 'x' : 'check-circle'} />
      <span>{text}</span>
    </div>
  );
}
