import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuoteStore } from '../../stores/quoteStore';
import { useUiPrefsStore } from '../../stores/uiPrefsStore';
import { formatCurrency } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { Alert } from '../ui/Alert';
import { api } from '../../api/client';

export function QuotesList() {
  const { quotes, isLoading, loadQuotes, deleteQuote } = useQuoteStore();
  const { tableDensity, setTableDensity } = useUiPrefsStore();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function emailQuote(id: number) {
    const to = window.prompt('Customer email address:')?.trim();
    if (!to) return;
    setMessage(null);
    try {
      const res = await api.post<{ sent?: boolean; method?: string; mailtoUri?: string; success?: boolean; message?: string }>(`/exports/email/${id}`, { to });
      if (!res.success) throw new Error(res.message || 'Could not email quote.');
      if (res.data.method === 'mailto' && res.data.mailtoUri) {
        window.location.href = res.data.mailtoUri;
        setMessage('Email opened in your mail client. Attach the PDF before sending.');
      } else if (res.data.success === false) {
        throw new Error(res.data.message || 'Could not email quote.');
      } else {
        setMessage(res.data.message || 'Quote emailed.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not email quote.');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadQuotes(statusFilter || undefined, search), 250);
    return () => window.clearTimeout(timer);
  }, [statusFilter, search]);

  async function performDelete(id: number, confirmed = false) {
    setDeleting(true);
    try {
      const deleted = await deleteQuote(id, confirmed);
      if (deleted) {
        setPendingDeleteId(null);
        await loadQuotes(statusFilter || undefined, search);
      } else {
        setMessage(useQuoteStore.getState().error || 'Could not delete quote.');
        setPendingDeleteId(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete(id: number) {
    const quote = quotes.find(q => q.id === id);
    if (quote?.status === 'approved') setPendingDeleteId(id);
    else void performDelete(id);
  }

  const pendingQuote = quotes.find(q => q.id === pendingDeleteId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">Quotes</h2>
        <Link to="/quotes/new" className="btn-primary">
          New Quote
        </Link>
      </div>
      {message && <Alert>{message}</Alert>}

      <div className="card !p-4 space-y-3">
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer, vehicle, VIN, quote number, notes, parts, or status..."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {['', 'draft', 'sent', 'approved', 'declined'].map(s => (
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
            <button
              type="button"
              aria-pressed={tableDensity === 'comfortable'}
              onClick={() => setTableDensity('comfortable')}
            >
              Comfortable
            </button>
            <button
              type="button"
              aria-pressed={tableDensity === 'compact'}
              onClick={() => setTableDensity('compact')}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card animate-pulse text-ink-subtle">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon="quotes"
          title={search || statusFilter ? 'No matching quotes' : 'No quotes yet'}
          description={
            search || statusFilter
              ? 'Try a different search or clear the status filter.'
              : 'Create a quote to start pricing parts, labor, and fees for a customer.'
          }
          action={
            search || statusFilter
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setStatusFilter('');
                  },
                }
              : { label: 'Create your first quote', to: '/quotes/new' }
          }
        />
      ) : (
        <div className={`card overflow-hidden !p-0 density-${tableDensity}`}>
          <table className="data-table">
            <thead className="table-head">
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-gray-800">
              {quotes.map(q => (
                <tr key={q.id} className="table-row">
                  <td className="font-medium text-brand-700 dark:text-brand-300">
                    <Link to={`/quotes/${q.id}`}>{q.quote_number}</Link>
                  </td>
                  <td className="text-ink-muted">
                    <div>{q.customer_name || '—'}</div>
                    {q.vehicle_summary && (
                      <div className="text-xs text-ink-subtle mt-0.5">{q.vehicle_summary}</div>
                    )}
                  </td>
                  <td><StatusBadge status={q.status} /></td>
                  <td className="text-right font-medium tabular-nums">
                    {formatCurrency(q.grand_total)}
                  </td>
                  <td className="text-ink-subtle text-xs">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`/quotes/${q.id}`} className="btn-ghost text-xs px-2 py-1">Edit</Link>
                      <a href={`/api/exports/pdf/${q.id}/view`} target="_blank" rel="noreferrer" className="btn-ghost text-xs px-2 py-1">PDF</a>
                      <button type="button" onClick={() => void emailQuote(q.id)} className="btn-ghost text-xs px-2 py-1">Email</button>
                      <button
                        type="button"
                        onClick={() => requestDelete(q.id)}
                        disabled={deleting}
                        className="btn-ghost text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete quote?"
        message={
          pendingQuote
            ? `Delete approved quote ${pendingQuote.quote_number}? Quotes with linked jobs or billing tickets cannot be deleted.`
            : 'Delete this quote? This cannot be undone.'
        }
        confirmLabel="Delete quote"
        danger
        busy={deleting}
        onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
        onConfirm={() => {
          if (pendingDeleteId != null) void performDelete(pendingDeleteId, true);
        }}
      />
    </div>
  );
}
