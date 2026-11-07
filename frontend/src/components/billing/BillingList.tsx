import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBillingStore } from '../../stores/billingStore';
import { useUiPrefsStore } from '../../stores/uiPrefsStore';
import { formatCurrency } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export function BillingList() {
  const { tickets, isLoading, loadTickets } = useBillingStore();
  const { tableDensity, setTableDensity } = useUiPrefsStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => loadTickets(statusFilter || undefined, search), 250);
    return () => window.clearTimeout(timer);
  }, [statusFilter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Billing</h2>
        <p className="page-subtitle">Tickets from completed jobs — mark paid when collected off-app</p>
      </div>

      <div className="card !p-4 space-y-3">
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ticket #, job, customer, vehicle..."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {['', 'open', 'paid', 'void'].map(s => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-brand-600 text-white dark:bg-brand-500'
                    : 'bg-surface-elevated text-ink-muted border border-line-strong hover:bg-surface-muted dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <div className="density-toggle" role="group" aria-label="Table density">
            <button type="button" aria-pressed={tableDensity === 'comfortable'} onClick={() => setTableDensity('comfortable')}>
              Comfortable
            </button>
            <button type="button" aria-pressed={tableDensity === 'compact'} onClick={() => setTableDensity('compact')}>
              Compact
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card animate-pulse text-ink-subtle">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="quotes"
          title={search || statusFilter ? 'No matching tickets' : 'No billing tickets yet'}
          description={
            search || statusFilter
              ? 'Try a different search or clear the status filter.'
              : 'Complete a job to open a billing ticket for the quoted total.'
          }
          action={
            search || statusFilter
              ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); } }
              : { label: 'Go to jobs', to: '/jobs' }
          }
        />
      ) : (
        <div className={`card overflow-hidden !p-0 density-${tableDensity}`}>
          <table className="data-table">
            <thead className="table-head">
              <tr>
                <th>Ticket #</th>
                <th>Customer</th>
                <th>Job</th>
                <th>Status</th>
                <th className="text-right">Amount due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="font-medium">
                    <Link to={`/billing/${t.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td>
                    <div>{t.customer_name || '—'}</div>
                    {t.vehicle_summary && (
                      <div className="text-xs text-ink-subtle max-w-[14rem] truncate">{t.vehicle_summary}</div>
                    )}
                  </td>
                  <td>
                    <Link to={`/jobs/${t.job_id}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                      {t.job_number}
                    </Link>
                    <div className="text-xs text-ink-subtle">{t.quote_number}</div>
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-right font-medium">{formatCurrency(t.amount_due_cents)}</td>
                  <td className="text-right">
                    <Link to={`/billing/${t.id}`} className="btn-ghost !px-2 !py-1 text-sm">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
