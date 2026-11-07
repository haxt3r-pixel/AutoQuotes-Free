import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBillingStore } from '../../stores/billingStore';
import { formatCurrency } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function BillingDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentTicket, isLoading, error, loadTicket, markPaid, voidTicket, clearCurrent } = useBillingStore();
  const [paymentNote, setPaymentNote] = useState('');
  const [confirmPay, setConfirmPay] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) loadTicket(Number(id));
    return () => clearCurrent();
  }, [id]);

  useEffect(() => {
    if (currentTicket) setPaymentNote(currentTicket.payment_note || '');
  }, [currentTicket?.id, currentTicket?.updated_at]);

  if (isLoading && !currentTicket) {
    return <div className="card animate-pulse text-ink-subtle">Loading ticket...</div>;
  }

  if (!currentTicket) {
    return (
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="card">Billing ticket not found.</div>
        <Link to="/billing" className="btn-secondary">Back to billing</Link>
      </div>
    );
  }

  const t = currentTicket;
  const open = t.status === 'open';

  async function handlePay() {
    setBusy(true);
    try {
      await markPaid(t.id, paymentNote || null);
      setConfirmPay(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    setBusy(true);
    try {
      await voidTicket(t.id, paymentNote || null);
      setConfirmVoid(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle mb-1">
            <Link to="/billing" className="hover:text-brand-600 dark:hover:text-brand-400">Billing</Link>
            <span>/</span>
            <span>{t.ticket_number}</span>
          </div>
          <h2 className="page-title flex flex-wrap items-center gap-3">
            <span>{t.ticket_number}</span>
            <StatusBadge status={t.status} />
          </h2>
          <p className="page-subtitle mt-1">
            Job{' '}
            <Link to={`/jobs/${t.job_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
              {t.job_number}
            </Link>
            {' · '}
            Quote{' '}
            <Link to={`/quotes/${t.quote_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
              {t.quote_number}
            </Link>
          </p>
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setConfirmPay(true)}>
              Mark paid in full
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmVoid(true)}>
              Void ticket
            </button>
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 space-y-3">
          <h3 className="section-title">Customer</h3>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-subtle">Name</dt>
              <dd className="font-medium">{t.customer_name || '—'}</dd>
              {t.customer_phone && <dd className="text-ink-muted">{t.customer_phone}</dd>}
            </div>
            <div>
              <dt className="text-ink-subtle">Vehicle</dt>
              <dd className="font-medium">{t.vehicle_summary || '—'}</dd>
            </div>
          </dl>
          <div>
            <label className="label" htmlFor="payment-note">Payment / closeout note</label>
            <textarea
              id="payment-note"
              className="input-field min-h-[100px]"
              value={paymentNote}
              onChange={e => setPaymentNote(e.target.value)}
              disabled={!open}
              placeholder="Cash, card last4, check #, collected by… (payment stays off-app)"
            />
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="section-title">Balance</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-ink-subtle">Amount due</span>
              <span className="font-semibold text-lg">{formatCurrency(t.amount_due_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-subtle">Amount paid</span>
              <span>{formatCurrency(t.amount_paid_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-subtle">Paid in full</span>
              <span>{t.paid_in_full ? 'Yes' : 'No'}</span>
            </div>
            {t.paid_at && (
              <div className="flex justify-between text-xs text-ink-subtle pt-1">
                <span>Paid at</span>
                <span>{new Date(t.paid_at).toLocaleString()}</span>
              </div>
            )}
            {t.closed_at && (
              <div className="flex justify-between text-xs text-ink-subtle">
                <span>Closed at</span>
                <span>{new Date(t.closed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-ink-subtle pt-3 border-t border-line dark:border-gray-700">
            Billing stays off this app. Use this ticket only to track whether the customer has paid in full.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPay}
        title="Mark ticket paid in full?"
        message={`Confirm that ${formatCurrency(t.amount_due_cents)} was collected off-app for ${t.ticket_number}.`}
        confirmLabel="Mark paid"
        busy={busy}
        onConfirm={handlePay}
        onCancel={() => setConfirmPay(false)}
      />
      <ConfirmDialog
        open={confirmVoid}
        title="Void this billing ticket?"
        message="Voided tickets cannot be marked paid. Use only if the job will not be billed."
        confirmLabel="Void ticket"
        danger
        busy={busy}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
      />
    </div>
  );
}
