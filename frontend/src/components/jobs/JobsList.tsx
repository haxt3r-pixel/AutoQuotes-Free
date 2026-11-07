import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJobStore } from '../../stores/jobStore';
import { useUiPrefsStore } from '../../stores/uiPrefsStore';
import { formatCurrency, getJobDisplayStatus } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { Alert } from '../ui/Alert';

export function JobsList() {
  const { jobs, isLoading, loadJobs, deleteJob } = useJobStore();
  const { tableDensity, setTableDensity } = useUiPrefsStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => loadJobs(statusFilter || undefined, search), 250);
    return () => window.clearTimeout(timer);
  }, [statusFilter, search]);

  async function performDelete(id: number, confirmed = false) {
    setDeleting(true);
    try {
      const deleted = await deleteJob(id, confirmed);
      if (deleted) {
        setPendingDeleteId(null);
        await loadJobs(statusFilter || undefined, search);
      } else {
        setDeleteError(useJobStore.getState().error || 'Could not delete job.');
        setPendingDeleteId(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete(id: number) {
    const job = jobs.find(candidate => candidate.id === id);
    if (job?.status === 'open') setPendingDeleteId(id);
    else void performDelete(id);
  }

  const pendingJob = jobs.find(job => job.id === pendingDeleteId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Jobs</h2>
          <p className="page-subtitle">Mechanic work orders from approved quotes</p>
        </div>
      </div>

      {deleteError && <Alert tone="error">{deleteError}</Alert>}

      <div className="card !p-4 space-y-3">
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job #, customer, vehicle, notes..."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {['', 'open', 'in_progress', 'completed', 'void', 'cancelled'].map(s => (
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
                {s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
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
        <div className="card animate-pulse text-ink-subtle">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="quotes"
          title={search || statusFilter ? 'No matching jobs' : 'No jobs yet'}
          description={
            search || statusFilter
              ? 'Try a different search or clear the status filter.'
              : 'Approve a quote to open a mechanic job automatically.'
          }
          action={
            search || statusFilter
              ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); } }
              : { label: 'Go to quotes', to: '/quotes' }
          }
        />
      ) : (
        <div className={`card overflow-hidden !p-0 density-${tableDensity}`}>
          <table className="data-table">
            <thead className="table-head">
              <tr>
                <th>Job #</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Checklist</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="table-row">
                  <td className="font-medium">
                    <Link to={`/jobs/${job.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {job.job_number}
                    </Link>
                    <div className="text-xs text-ink-subtle">{job.quote_number}</div>
                  </td>
                  <td>
                    <div>{job.customer_name || '—'}</div>
                    {job.customer_phone && <div className="text-xs text-ink-subtle">{job.customer_phone}</div>}
                  </td>
                  <td className="max-w-[14rem] truncate" title={job.vehicle_summary || undefined}>
                    {job.vehicle_summary || '—'}
                  </td>
                  <td className="text-sm text-ink-muted">
                    {job.items_done ?? 0}/{job.items_total ?? 0}
                  </td>
                  <td><StatusBadge status={getJobDisplayStatus(job)} /></td>
                  <td className="text-right font-medium">{formatCurrency(job.grand_total)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`/jobs/${job.id}`} className="btn-ghost !px-2 !py-1 text-sm">Open</Link>
                      <button
                        type="button"
                        onClick={() => requestDelete(job.id)}
                        disabled={deleting}
                        className="btn-ghost !px-2 !py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
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
        title="Delete open job?"
        message={
          pendingJob
            ? `Delete open job ${pendingJob.job_number}? This cannot be undone.`
            : 'Delete this open job? This cannot be undone.'
        }
        confirmLabel="Delete job"
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
