import { Link } from 'react-router-dom';

interface EmptyStateAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
  icon?: 'quotes' | 'customers' | 'items' | 'generic';
  className?: string;
}

function EmptyIcon({ kind }: { kind: NonNullable<EmptyStateProps['icon']> }) {
  const common = 'h-12 w-12 text-ink-subtle';
  if (kind === 'quotes') {
    return (
      <svg viewBox="0 0 48 48" className={common} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="10" y="8" width="28" height="34" rx="3" />
        <path strokeLinecap="round" d="M17 18h14M17 25h14M17 32h9" />
      </svg>
    );
  }
  if (kind === 'customers') {
    return (
      <svg viewBox="0 0 48 48" className={common} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <circle cx="24" cy="16" r="6" />
        <path strokeLinecap="round" d="M12 36c2.5-6 7-9 12-9s9.5 3 12 9" />
      </svg>
    );
  }
  if (kind === 'items') {
    return (
      <svg viewBox="0 0 48 48" className={common} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 16h28l-2 22H12L10 16z" />
        <path strokeLinecap="round" d="M18 16V12a6 6 0 0 1 12 0v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={common} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="24" cy="24" r="14" />
      <path strokeLinecap="round" d="M24 18v8M24 32h.01" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'generic',
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`card text-center py-12 px-6 ${className}`.trim()}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted dark:bg-gray-800/80">
        <EmptyIcon kind={icon} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-ink-subtle max-w-sm mx-auto">{description}</p>}
      {action && (
        <div className="mt-5">
          {action.to ? (
            <Link to={action.to} className="btn-primary">{action.label}</Link>
          ) : (
            <button type="button" className="btn-primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
