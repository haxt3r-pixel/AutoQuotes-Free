import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Customer } from '../../types';
import { Alert } from '../ui/Alert';
import { EmptyState } from '../ui/EmptyState';

type CustomerForm = Pick<Customer,
  'name' | 'phone' | 'email' | 'address_street' | 'address_city' | 'address_state' | 'address_zip' | 'notes'
>;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC',
];

function formatCustomerAddress(customer: Customer): string {
  return [
    customer.address_street || customer.address,
    [customer.address_city, customer.address_state].filter(Boolean).join(', '),
    customer.address_zip,
  ].filter(Boolean).join(' ');
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CustomerForm>({
    name: '', phone: '', email: '', address_street: '', address_city: '',
    address_state: '', address_zip: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '?limit=200';
      const res = await api.get<Customer[]>(`/customers${query}`);
      if (res.success) setCustomers(res.data);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  function beginEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address_street: customer.address_street || customer.address || '',
      address_city: customer.address_city || '',
      address_state: customer.address_state || '',
      address_zip: customer.address_zip || '',
      notes: customer.notes || '',
    });
    setMessage(null);
  }

  async function saveCustomer() {
    if (!editingId || !editForm.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put<Customer>(`/customers/${editingId}`, {
        name: editForm.name.trim(),
        phone: editForm.phone?.trim() || null,
        email: editForm.email?.trim() || null,
        address_street: editForm.address_street?.trim() || null,
        address_city: editForm.address_city?.trim() || null,
        address_state: editForm.address_state?.trim() || null,
        address_zip: editForm.address_zip?.trim() || null,
        notes: editForm.notes?.trim() || null,
      });
      if (!res.success) {
        setMessage(res.message || 'Could not save customer changes.');
        return;
      }
      setCustomers(current => current.map(customer =>
        customer.id === editingId
          ? { ...customer, ...res.data }
          : customer,
      ));
      setEditingId(null);
      setMessage('Customer details updated.');
    } catch {
      setMessage('Could not save customer changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Customers</h2>
          <p className="text-sm text-ink-subtle">Customer records and their saved vehicles are used across quotes.</p>
        </div>
        <Link to="/quotes/new" className="btn-primary">New Customer Quote</Link>
      </div>
      <div className="card !p-4">
        <input className="input-field" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, address, or notes..." />
      </div>
      {message && (
        <Alert tone={message === 'Customer details updated.' ? 'success' : 'error'}>
          {message}
        </Alert>
      )}
      {loading ? (
        <div className="card text-ink-subtle">Loading customers...</div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon="customers"
          title={search.trim() ? 'No matching customers' : 'No customers yet'}
          description={
            search.trim()
              ? 'Try a different name, phone, email, or address.'
              : 'Customer records are created while building a quote, then reused across jobs.'
          }
          action={
            search.trim()
              ? { label: 'Clear search', onClick: () => setSearch('') }
              : { label: 'Start a new quote', to: '/quotes/new' }
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customers.map(customer => (
            <div key={customer.id} className="card">
              {editingId === customer.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Name</label>
                    <input className="input-field" value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Phone</label>
                      <input className="input-field" value={editForm.phone || ''}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input className="input-field" type="email" value={editForm.email || ''}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Street Address</label>
                    <input className="input-field" value={editForm.address_street || ''}
                      onChange={e => setEditForm({ ...editForm, address_street: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">City</label>
                      <input className="input-field" value={editForm.address_city || ''}
                        onChange={e => setEditForm({ ...editForm, address_city: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">State</label>
                      <select className="input-field" value={editForm.address_state || ''}
                        onChange={e => setEditForm({ ...editForm, address_state: e.target.value })}>
                        <option value="">—</option>
                        {US_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">ZIP Code</label>
                      <input className="input-field" value={editForm.address_zip || ''} maxLength={10}
                        onChange={e => setEditForm({ ...editForm, address_zip: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="input-field min-h-20" value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={saveCustomer}
                      disabled={saving || !editForm.name.trim()}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)} disabled={saving}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{customer.name}</h3>
                    {customer.phone && <p className="text-sm text-ink-muted">{customer.phone}</p>}
                    {customer.email && <p className="text-sm text-ink-muted">{customer.email}</p>}
                    {formatCustomerAddress(customer) && (
                      <p className="text-sm text-ink-subtle mt-2">{formatCustomerAddress(customer)}</p>
                    )}
                    {customer.notes && <p className="text-sm text-ink-subtle mt-2 whitespace-pre-wrap">{customer.notes}</p>}
                    <p className="text-xs text-ink-subtle dark:text-gray-500 mt-3">
                      {customer.vehicle_count || 0} saved vehicle(s) · {customer.quote_count || 0} quote(s)
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => beginEdit(customer)} className="btn-secondary h-fit text-xs">Edit</button>
                    <Link to={`/quotes/new?customer=${customer.id}`} className="btn-secondary h-fit text-xs">New Quote</Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
