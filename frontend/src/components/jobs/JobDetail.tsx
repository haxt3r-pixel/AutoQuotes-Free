import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useJobStore } from '../../stores/jobStore';
import { formatCurrency, getJobDisplayStatus } from '../../types';
import { StatusBadge, TypeBadge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentJob, isLoading, error, loadJob, updateJob, updateItem, completeJob, clearCurrent } = useJobStore();
  const [mechanicNotes, setMechanicNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [itemNoteDrafts, setItemNoteDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (id) loadJob(Number(id));
    return () => clearCurrent();
  }, [id]);

  useEffect(() => {
    if (!currentJob) return;
    setMechanicNotes(currentJob.header.mechanic_notes || '');
    setCompletionNotes(currentJob.header.completion_notes || '');
    const drafts: Record<number, string> = {};
    for (const item of currentJob.items) {
      drafts[item.id] = item.mechanic_note || '';
    }
    setItemNoteDrafts(drafts);
  }, [currentJob?.header.id, currentJob?.header.updated_at]);

  if (isLoading && !currentJob) {
    return <div className="card animate-pulse text-ink-subtle">Loading job...</div>;
  }

  if (!currentJob) {
    return (
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="card">Job not found.</div>
        <Link to="/jobs" className="btn-secondary">Back to jobs</Link>
      </div>
    );
  }

  const { header, items } = currentJob;
  const closed = header.status === 'completed' || header.status === 'cancelled';
  const doneCount = items.filter(i => i.is_done).length;

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await updateJob(header.id, {
        mechanic_notes: mechanicNotes,
        completion_notes: completionNotes,
      });
    } finally {
      setSavingNotes(false);
    }
  }

  async function startJob() {
    await updateJob(header.id, { status: 'in_progress' });
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const result = await completeJob(header.id, completionNotes || mechanicNotes || null);
      setConfirmComplete(false);
      if (result?.ticket) {
        navigate(`/billing/${result.ticket.id}`);
      }
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle mb-1">
            <Link to="/jobs" className="hover:text-brand-600 dark:hover:text-brand-400">Jobs</Link>
            <span>/</span>
            <span>{header.job_number}</span>
          </div>
          <h2 className="page-title flex flex-wrap items-center gap-3">
            <span>{header.job_number}</span>
            <StatusBadge status={getJobDisplayStatus(header)} />
          </h2>
          <p className="page-subtitle mt-1">
            From{' '}
            <Link to={`/quotes/${header.quote_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
              {header.quote_number}
            </Link>
            {header.billing_ticket_number && (
              <>
                {' · '}
                <Link
                  to={`/billing/${header.billing_ticket_id}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {header.billing_ticket_number}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {header.status === 'open' && (
            <button type="button" className="btn-primary" onClick={startJob}>Start job</button>
          )}
          {!closed && (
            <button type="button" className="btn-primary" onClick={() => setConfirmComplete(true)}>
              Complete &amp; bill
            </button>
          )}
          {header.billing_ticket_id && (
            <Link to={`/billing/${header.billing_ticket_id}`} className="btn-secondary">
              Open billing
            </Link>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 space-y-3">
          <h3 className="section-title">Vehicle &amp; customer</h3>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-subtle">Customer</dt>
              <dd className="font-medium text-ink">{header.customer_name || '—'}</dd>
              {header.customer_phone && <dd className="text-ink-muted">{header.customer_phone}</dd>}
              {header.customer_email && <dd className="text-ink-muted">{header.customer_email}</dd>}
            </div>
            <div>
              <dt className="text-ink-subtle">Vehicle</dt>
              <dd className="font-medium text-ink">{header.vehicle_summary || '—'}</dd>
              {header.vehicle_vin && <dd className="text-ink-muted font-mono text-xs">VIN {header.vehicle_vin}</dd>}
              {header.vehicle_mileage && <dd className="text-ink-muted">{header.vehicle_mileage} mi</dd>}
            </div>
          </dl>
          {header.quote_notes && (
            <div className="rounded-lg bg-surface-muted p-3 text-sm dark:bg-gray-800/60">
              <div className="text-xs font-medium text-ink-subtle mb-1">Quote notes</div>
              <p className="text-ink whitespace-pre-wrap">{header.quote_notes}</p>
            </div>
          )}
        </div>

        <div className="card space-y-2">
          <h3 className="section-title">Totals</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-ink-subtle">Parts</span><span>{formatCurrency(header.parts_subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Labor</span><span>{formatCurrency(header.labor_subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Fees</span><span>{formatCurrency(header.shop_fee_amount + header.misc_fees_total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Tax</span><span>{formatCurrency(header.tax_total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Shipping</span><span>{formatCurrency(header.shipping_total)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold dark:border-gray-700">
              <span>Grand total</span><span>{formatCurrency(header.grand_total)}</span>
            </div>
          </div>
          <p className="text-xs text-ink-subtle pt-2">Checklist {doneCount}/{items.length}</p>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line dark:border-gray-800 flex items-center justify-between">
          <h3 className="section-title !mb-0">Work checklist</h3>
          <span className="text-xs text-ink-subtle">{doneCount} of {items.length} done</span>
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-sm text-ink-subtle">No line items on this job.</div>
        ) : (
          <ul className="divide-y divide-line dark:divide-gray-800">
            {items.map(item => (
              <li key={item.id} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-start">
                <label className="flex items-start gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                    checked={!!item.is_done}
                    disabled={closed}
                    onChange={e => updateItem(header.id, item.id, { is_done: e.target.checked })}
                  />
                  <span className="min-w-0">
                    <span className={`block font-medium ${item.is_done ? 'line-through text-ink-subtle' : 'text-ink'}`}>
                      {item.description}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      <TypeBadge type={item.item_type} />
                      {item.priority && <StatusBadge status={item.priority} />}
                      {item.part_number && <span className="font-mono">{item.part_number}</span>}
                      {item.vendor && <span>{item.vendor}</span>}
                      <span>×{item.quantity}</span>
                      <span>{formatCurrency(item.line_total)}</span>
                    </span>
                  </span>
                </label>
                <div className="sm:w-64 shrink-0">
                  <input
                    className="input-field text-sm"
                    placeholder="Mechanic note"
                    value={itemNoteDrafts[item.id] ?? ''}
                    disabled={closed}
                    onChange={e => setItemNoteDrafts(d => ({ ...d, [item.id]: e.target.value }))}
                    onBlur={() => {
                      const next = itemNoteDrafts[item.id] ?? '';
                      const prev = item.mechanic_note || '';
                      if (next !== prev) {
                        updateItem(header.id, item.id, { mechanic_note: next || null });
                      }
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="section-title">Mechanic notes</h3>
          <textarea
            className="input-field min-h-[120px]"
            value={mechanicNotes}
            onChange={e => setMechanicNotes(e.target.value)}
            placeholder="Diagnosis, findings, parts used, follow-ups..."
          />
          <button type="button" className="btn-secondary" onClick={saveNotes} disabled={savingNotes}>
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
        <div className="card space-y-3">
          <h3 className="section-title">Completion notes</h3>
          <textarea
            className="input-field min-h-[120px]"
            value={completionNotes}
            onChange={e => setCompletionNotes(e.target.value)}
            placeholder="What was completed, road test results, customer advisories..."
          />
          {!closed && (
            <p className="text-xs text-ink-subtle">
              These notes are saved when you complete the job and open billing.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmComplete}
        title="Complete job and open billing?"
        message="This marks the job complete and creates a billing ticket for the quoted total. Payment is tracked off-app — you can mark the ticket paid when the customer settles."
        confirmLabel="Complete & bill"
        busy={completing}
        onConfirm={handleComplete}
        onCancel={() => setConfirmComplete(false)}
      />
    </div>
  );
}
