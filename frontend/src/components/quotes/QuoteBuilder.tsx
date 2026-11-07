import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuoteStore } from '../../stores/quoteStore';
import { useAiStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVehicleStore, type Vehicle } from '../../stores/vehicleStore';
import { formatCurrency, centsToDollars } from '../../types';
import type { LineItem, ScrapedPart, Customer } from '../../types';
import { api } from '../../api/client';

function isRockAutoListing(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'rockauto.com' || url.hostname.endsWith('.rockauto.com'));
  } catch {
    return false;
  }
}

export function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const creationStarted = useRef(false);
  const { 
    currentQuote, lineItems, isLoading, error: storeError,
    loadQuote, createQuote, addLineItem, updateLineItem, removeLineItem,
    updateStatus, updateQuote, applyCategorization,
  } = useQuoteStore();
  const { polishNote, explainPart, categorizeItems, searchParts, isProcessing: aiProcessing } = useAiStore();
  const { settings, loadSettings } = useSettingsStore();

  // Load settings when builder mounts (ensures labor rate available)
  useEffect(() => { loadSettings(); }, []);

  // Sync markup from settings when loaded
  useEffect(() => {
    if (settings.markup_default !== undefined && settings.markup_default !== null) {
      setNewMarkup(String(settings.markup_default as number));
    }
  }, [settings.markup_default]);

  // Derive labor rate from settings
  const laborRateDollars = settings.labor_rate
    ? String((settings.labor_rate as number) / 100)
    : '120.00';

  // New line item form
  const [newItemType, setNewItemType] = useState<'part' | 'labor' | 'misc' | 'fee'>('part');
  const [newDescription, setNewDescription] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newMarkup, setNewMarkup] = useState('30');
  const [addingItem, setAddingItem] = useState(false);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [totalShipping, setTotalShipping] = useState<{ cost: number; method: string; delivery: string; message?: string } | null>(null);
  const importedSourceUrls = useRef<Record<string, string>>({}); // part_number -> source_url
  const importedCartForms = useRef<Record<string, { action: string; nck: string; fields: Record<string, string> }>>({});

  // Reset shipping when line items change (parts added/removed)
  useEffect(() => {
    setTotalShipping(null);
  }, [lineItems.length]);

  // Parts search state
  const [partsQuery, setPartsQuery] = useState('');
  const [searchResults, setSearchResults] = useState<import('../../types').ScrapedPart[]>([]);
  const [searching, setSearching] = useState(false);
  const [showPartsSearch, setShowPartsSearch] = useState(false);
  const [shippingCalcs, setShippingCalcs] = useState<Record<string, { loading: boolean; cost: number | null; formula: string | null }>>({});

  // Vehicle selection
  const { vehicles, loadVehicles, createVehicle } = useVehicleStore();
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [drivetrains, setDrivetrains] = useState<string[]>([]);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    year: new Date().getFullYear(),
    make: '', model: '', submodel: '', engine: '', drivetrain: '',
  });

  // Catalog cascading dropdowns
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<{ model: string; yearRange: [number, number] | null; trimCount: number }[]>([]);
  const [trimNames, setTrimNames] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTrims, setLoadingTrims] = useState(false);

  // Auto-fill labor rate when type switches to labor
  const handleTypeChange = useCallback((type: 'part' | 'labor' | 'misc' | 'fee') => {
    setNewItemType(type);
    if (type === 'labor') {
      setNewCost(laborRateDollars);
      setNewQty('1');
    }
  }, [laborRateDollars]);

  // Notes
  const [notes, setNotes] = useState('');

  // Track creation state
  const [createFailed, setCreateFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      creationStarted.current = false;
      loadQuote(parseInt(id, 10));
    } else if (!creationStarted.current) {
      creationStarted.current = true;
      handleCreateNew();
    }
  }, [id]);

  useEffect(() => {
    void api.get<Customer[]>('/customers?limit=1000').then(res => { if (res.success) setCustomers(res.data); });
  }, []);

  useEffect(() => {
    void loadVehicles(currentQuote?.customer_id ?? undefined);
    setSelectedVehicleId(currentQuote?.vehicle_id ?? null);
  }, [currentQuote?.id, currentQuote?.customer_id, currentQuote?.vehicle_id]);

  useEffect(() => {
    if (currentQuote) {
      setNotes(currentQuote.notes || '');
    }
  }, [currentQuote?.id]);

  async function handleCreateNew() {
    setCreating(true);
    setCreateFailed(false);
    try {
      const customerId = Number(searchParams.get('customer'));
      const quote = await createQuote(customerId > 0 ? { customer_id: customerId } : undefined);
      if (quote) {
        setCreating(false);
        navigate(`/quotes/${quote.id}`, { replace: true });
      } else {
        setCreateFailed(true);
        setCreating(false);
      }
    } catch (err) {
      console.error('Failed to create quote:', err);
      setCreateFailed(true);
      setCreating(false);
    }
  }

  async function handleAddItem() {
    if (!currentQuote || !newDescription.trim()) return;
    setAddingItem(true);
    try {
      const cost = newCost ? Math.round(parseFloat(newCost) * 100) : 0;
      const qty = parseFloat(newQty) || 1;
      await addLineItem({
        item_type: newItemType,
        description: newDescription.trim(),
        unit_cost: cost,
        markup_percent: newItemType === 'part' ? (parseFloat(newMarkup) ?? 0) : 0,
        quantity: qty,
      });
      setNewDescription('');
      setNewCost('');
      setNewQty('1');
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAddingItem(false);
    }
  }

  async function handlePolishNotes() {
    if (!notes.trim()) return;
    const polished = await polishNote(notes);
    if (polished && polished !== notes) {
      setNotes(polished);
      if (currentQuote) await updateQuote(currentQuote.id, { notes: polished });
    } else if (polished === notes) {
      // AI returned same text — likely not available
      alert('⚠️ AI is not available. Make sure LM Studio is running with a model loaded.');
    }
  }

  async function handleExplainItem(item: LineItem) {
    const explanation = await explainPart(item.description);
    if (explanation) {
      // Cache in store and display
      alert(`💡 AI Explanation:\n\n${explanation}`);
    }
  }

  async function handleAutoCategorize() {
    const items = lineItems.map((item, i) => ({
      index: i,
      description: item.description,
      cost: item.unit_cost,
    }));
    const categorized = await categorizeItems(items, notes.trim() || undefined);
    if (categorized) {
      applyCategorization(categorized);
    }
  }

  async function handlePartsSearch() {
    if (!partsQuery.trim() || partsQuery.trim().length < 2) return;
    setSearching(true);
    setSearchResults([]);
    try {
      // Build vehicle context string for targeted search
      const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
      const vehicleCtx = selectedVehicle
        ? [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model, selectedVehicle.engine]
            .filter(Boolean).join(' ')
        : undefined;
      const zipCode = settings.shop_zip_code as string | undefined;

      const results = await searchParts(partsQuery.trim(), { vehicleContext: vehicleCtx, zipCode });
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateVehicle() {
    if (!currentQuote?.customer_id) { alert('Select a customer before adding a vehicle.'); return; }
    const v = await createVehicle({ ...newVehicle, customer_id: currentQuote.customer_id });
    if (v) {
      const updated = await updateQuote(currentQuote.id, { vehicle_id: v.id });
      if (!updated) return;
      setSelectedVehicleId(v.id);
      setShowNewVehicleForm(false);
      setNewVehicle({ year: new Date().getFullYear(), make: '', model: '', submodel: '', engine: '', drivetrain: '' });
    }
  }

  // Catalog cascade handlers
  async function loadMakesForForm() {
    setLoadingMakes(true);
    try {
      const data = await api.getMakes();
      setMakes(data);
    } finally { setLoadingMakes(false); }
  }

  async function loadModelsForMake(make: string) {
    if (!make) { setModels([]); setTrimNames([]); return; }
    setLoadingModels(true);
    try {
      const data = await api.getModels(make, newVehicle.year ?? undefined);
      setModels(data);
      setTrimNames([]);
    } finally { setLoadingModels(false); }
  }

  async function loadTrimsForModel(make: string, model: string) {
    if (!model) { setTrimNames([]); return; }
    setLoadingTrims(true);
    try {
      const data = await api.getTrims(make, model, newVehicle.year ?? undefined);
      setTrimNames(data);
    } finally { setLoadingTrims(false); }
  }

  async function handleTrimSelected(make: string, model: string, trim: string) {
    if (!trim) {
      setNewVehicle({ ...newVehicle, submodel: '', engine: '', drivetrain: '' });
      return;
    }
    const choices = await api.getEngines(make, model, trim, newVehicle.year ?? undefined);
    const engine = choices.length === 1 ? choices[0] : '';
    const drives = await api.getDrivetrains(make, model, trim, newVehicle.year ?? undefined, engine || undefined);
    setEngines(choices);
    setDrivetrains(drives);
    setNewVehicle(prev => ({ ...prev, submodel: trim, engine, drivetrain: drives.length === 1 ? drives[0] : '' }));
  }

  function getVehicleLabel(v: Vehicle): string {
    return [v.year, v.make, v.model, v.submodel, v.engine, v.drivetrain].filter(Boolean).join(' ') || `Vehicle #${v.id}`;
  }

  async function handleImportPart(part: import('../../types').ScrapedPart) {
    if (!currentQuote) return;
    // Check if a shipping cost was calculated for this part
    const shipInfo = shippingCalcs[part.vendor_part_id];
    const shipCost = shipInfo?.cost || 0;
    
    try {
      await addLineItem({
        item_type: 'part',
        description: `${part.part_name}${part.part_number ? ` (${part.part_number})` : ''} — via ${part.vendor}`,
        unit_cost: part.price_cents,
        markup_percent: parseFloat(newMarkup) ?? 0,
        quantity: 1,
        vendor: part.vendor,
        vendor_part_id: part.vendor_part_id,
        part_number: part.part_number,
        brand: part.brand,
        source_url: part.source_url,
        option_value: part.option_value,
      });
      
      // If shipping was calculated, add it as a shipping line item
      if (shipCost > 0 && shipInfo?.formula) {
        await addLineItem({
          item_type: 'shipping',
          description: `Shipping: ${part.brand || ''} ${part.part_number || part.part_name.substring(0, 40)} — ${shipInfo.formula}`,
          unit_cost: shipCost,
          quantity: 1,
        });
      }
      
      // Remove imported part from results to show it was added
      setSearchResults(prev => prev.filter(p => p.vendor_part_id !== part.vendor_part_id));
      // Track source URL and cart form data for purchase
      if (part.source_url && part.part_number) {
        importedSourceUrls.current[part.part_number] = part.source_url;
      }
      if (part.cart_action && part.part_number) {
        importedCartForms.current[part.part_number] = {
          action: part.cart_action,
          nck: part.cart_nck || '',
          fields: part.cart_hidden_fields || {},
        };
      }
      // Auto-add to persistent background cart
      if (part.source_url && part.part_number) {
        api.post('/parts/cart/add', {
          part_number: part.part_number,
          listing_url: part.source_url,
          part_name: part.part_name,
          option_value: part.option_value,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to import part:', err);
    }
  }

  async function handleCalcShippingQuote() {
    const partsToShip: { part_number: string; listing_url: string; part_name: string; quantity: number; option_value?: string }[] = [];
    for (const li of lineItems.filter(l => l.item_type === 'part')) {
      const isRockAuto = li.vendor === 'RockAuto' || /via RockAuto/i.test(li.description || '');
      if (isRockAuto && li.part_number) {
        const url = li.source_url || importedSourceUrls.current[li.part_number] || ''; 
        partsToShip.push({
          part_number: li.part_number,
          listing_url: url,
          part_name: li.description.substring(0, 80),
          quantity: li.quantity,
          option_value: li.option_value ?? undefined,
        });
      }
    }

    if (partsToShip.length === 0) {
      alert('No RockAuto parts found. Add parts from RockAuto search first.');
      return;
    }

    const missingUrls = partsToShip.filter(p => !p.listing_url).length;
    if (missingUrls === partsToShip.length) {
      alert('Parts were found but source URLs are missing. Please re-add parts from a fresh search, or manually enter shipping costs.');
      return;
    }
    if (missingUrls > 0) {
      console.warn(`${missingUrls} parts have no listing URL — skipping them`);
    }

    setCalculatingShipping(true);
    setTotalShipping(null);

    try {
      const res = await api.post<{
        rockauto_shipping: { total_shipping_cents: number; shipping_method: string; estimated_delivery: string };
        rockauto_parts_count: number; non_rockauto_parts_count: number; total_shipping_cents: number; message?: string;
      }>('/parts/shipping/checkout', {
        parts: partsToShip,
        zipCode: settings.shop_zip_code || '',
      });

      if (res.success) {
        for (const item of lineItems.filter(item => item.item_type === 'shipping' && item.description.startsWith('Shipping: '))) {
          await removeLineItem(item.id);
        }
        const oldEstimate = lineItems.find(item => item.item_type === 'shipping' && item.description === 'RockAuto checkout shipping');
        if (oldEstimate) {
          await updateLineItem(oldEstimate.id, { unit_cost: res.data.total_shipping_cents });
        } else {
          await addLineItem({ item_type: 'shipping', description: 'RockAuto checkout shipping', unit_cost: res.data.total_shipping_cents, quantity: 1 });
        }
        setTotalShipping({
          cost: res.data.total_shipping_cents,
          method: res.data.rockauto_shipping.shipping_method,
          delivery: res.data.rockauto_shipping.estimated_delivery,
          message: res.data.message,
        });
      } else {
        alert(res.message || 'Unable to calculate shipping.');
      }
    } catch (err) {
      console.error('Shipping calc failed:', err);
      alert('Failed to calculate shipping. Make sure RockAuto parts are in the quote.');
    } finally {
      setCalculatingShipping(false);
    }
  }

  async function handlePurchaseParts() {
    const urlsToOpen: string[] = [];
    
    for (const li of lineItems.filter(l => l.item_type === 'part')) {
      const isRockAuto = li.vendor === 'RockAuto' || /via RockAuto/i.test(li.description || '');
      const url = li.source_url || (li.part_number ? importedSourceUrls.current[li.part_number] : '');
      if (isRockAuto && url && isRockAutoListing(url)) {
        urlsToOpen.push(url);
      }
    }

    if (urlsToOpen.length === 0) {
      alert('No RockAuto parts with listing URLs found. Please re-add parts from a fresh AI search.');
      return;
    }

    // Open each listing page — then open cart page
    // RockAuto uses AJAX (not form POST) for Add to Cart, so cross-origin
    // form submission is ignored. The user must click Add to Cart on each page.
    for (let i = 0; i < urlsToOpen.length; i++) {
      if (i === 0) {
        window.open(urlsToOpen[i], '_blank');
      } else {
        setTimeout(() => window.open(urlsToOpen[i], '_blank'), i * 600);
      }
    }

    // Open cart after all pages
    setTimeout(() => {
      window.open('https://www.rockauto.com/en/cart/', '_blank');
    }, urlsToOpen.length * 600 + 500);

    alert(`Opening ${urlsToOpen.length} RockAuto page(s).\n\nOn each page, click the green "Add to Cart" button. Then go to your cart tab to complete checkout.`);
  }

  async function handleCalcShipping(part: import('../../types').ScrapedPart) {
    const key = part.vendor_part_id;
    // Don't recalculate if already loading or done
    if (shippingCalcs[key]?.loading || shippingCalcs[key]?.cost != null) return;
    
    setShippingCalcs(prev => ({ ...prev, [key]: { loading: true, cost: null, formula: null } }));
    
    try {
      const res = await api.post<{ shipping_cents: number; shipping_dollars: number; formula: string }>('/parts/shipping', {
        partPrice: part.price_cents,
        partName: part.part_name,
        zipCode: settings.shop_zip_code || '',
        sourceUrl: part.source_url,
      });
      
      if (res.success) {
        setShippingCalcs(prev => ({
          ...prev,
          [key]: { loading: false, cost: res.data.shipping_cents, formula: res.data.formula },
        }));
      } else {
        setShippingCalcs(prev => ({ ...prev, [key]: { loading: false, cost: null, formula: 'Failed' } }));
      }
    } catch {
      setShippingCalcs(prev => ({ ...prev, [key]: { loading: false, cost: null, formula: 'Error' } }));
    }
  }

  // Loading while creating via API
  if (creating || (isLoading && (!currentQuote || (id && id !== 'new' && currentQuote.id !== Number(id))))) {
    return <div className="card animate-pulse text-gray-400">Creating new quote...</div>;
  }

  // Error state with retry
  if (!currentQuote && (createFailed || storeError)) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 font-medium mb-2">❌ Failed to create quote</p>
        <p className="text-gray-500 mb-4 text-sm">
          {storeError || 'The server may not be running or the database is not initialized.'}
        </p>
        <button onClick={handleCreateNew} className="btn-primary">
          🔄 Retry
        </button>
      </div>
    );
  }

  // Fallback (shouldn't be reached)
  if (!currentQuote) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">Creating new quote...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {storeError && <div className="card text-red-600" role="alert">{storeError}</div>}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {currentQuote.quote_number}
            <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${
              currentQuote.status === 'draft' ? 'bg-gray-100 text-gray-600' :
              currentQuote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
              currentQuote.status === 'approved' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {currentQuote.status}
            </span>
          </h2>
          <p className="text-sm text-gray-500">Created {new Date(currentQuote.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          {currentQuote.status === 'draft' && (
            <button onClick={async () => { if (notes !== (currentQuote.notes || '')) { const saved = await updateQuote(currentQuote.id, { notes }); if (!saved) return; } await updateStatus(currentQuote.id, 'sent'); }} className="btn-primary">
              📤 Mark Sent
            </button>
          )}
          {(currentQuote.status === 'draft' || currentQuote.status === 'sent') && (
            <button onClick={async () => { if (notes !== (currentQuote.notes || '')) { const saved = await updateQuote(currentQuote.id, { notes }); if (!saved) return; } await updateStatus(currentQuote.id, 'approved'); }} className="btn-secondary">
              ✅ Approve
            </button>
          )}
        </div>
      </div>

      <fieldset disabled={currentQuote.status === 'approved'} className="contents">
      {/* Vehicle Selector */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">🚗 Vehicle</h3>
        <label className="label">Customer</label>
        <select className="input-field mb-3" value={currentQuote.customer_id ?? ''} onChange={async e => {
          let customerId = e.target.value ? Number(e.target.value) : null;
          if (e.target.value === 'new') {
            const name = window.prompt('Customer name:')?.trim();
            if (!name) return;
            const result = await api.post<Customer>('/customers', { name });
            if (!result.success) { alert(result.message || 'Could not create customer'); return; }
            setCustomers(prev => [...prev, result.data]);
            customerId = result.data.id;
          }
          await updateQuote(currentQuote.id, { customer_id: customerId, vehicle_id: null });
        }}>
          <option value="">— No customer selected —</option>
          <option value="new">➕ Add New Customer...</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <select
            className="input-field flex-1"
            value={selectedVehicleId ?? ''}
            onChange={async e => {
              const val = e.target.value;
              if (val === 'new') {
                setShowNewVehicleForm(true);
              } else if (val === '') {
                if (await updateQuote(currentQuote.id, { vehicle_id: null })) setSelectedVehicleId(null);
              } else {
                if (await updateQuote(currentQuote.id, { vehicle_id: parseInt(val, 10) })) setSelectedVehicleId(parseInt(val, 10));
                setShowNewVehicleForm(false);
              }
            }}
          >
            <option value="">— No vehicle selected —</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{getVehicleLabel(v)}</option>
            ))}
            <option value="new">➕ Add New Vehicle...</option>
          </select>
          {selectedVehicleId && (
            <button
              onClick={async () => { if (await updateQuote(currentQuote.id, { vehicle_id: null })) setSelectedVehicleId(null); }}
              className="btn-ghost text-xs text-red-500"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {selectedVehicleId && vehicles.find(v => v.id === selectedVehicleId) && (
          <p className="text-xs text-brand-700 mt-2">
            ✅ Parts search will target: {getVehicleLabel(vehicles.find(v => v.id === selectedVehicleId)!)}
          </p>
        )}

        {showNewVehicleForm && (
          <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">New Vehicle (Select from catalog)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className="label">Year</label>
                <input type="number" className="input-field" value={newVehicle.year || ''} min={1988} max={2025}
                  onChange={e => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) || undefined })} />
              </div>
              <div>
                <label className="label">Make {loadingMakes && '⏳'}</label>
                <select className="input-field" value={newVehicle.make || ''}
                  onChange={e => {
                    const make = e.target.value;
                    setNewVehicle({ ...newVehicle, make, model: '', submodel: '', engine: '', drivetrain: '' });
                    loadModelsForMake(make);
                  }}
                  onFocus={() => { if (makes.length === 0) loadMakesForForm(); }}>
                  <option value="">— Select Make —</option>
                  {makes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Model {loadingModels && '⏳'}</label>
                <select className="input-field" value={newVehicle.model || ''}
                  disabled={!newVehicle.make}
                  onChange={e => {
                    const model = e.target.value;
                    setNewVehicle({ ...newVehicle, model, submodel: '', engine: '', drivetrain: '' });
                    loadTrimsForModel(newVehicle.make!, model);
                  }}>
                  <option value="">— Select Model —</option>
                  {models.map(m => <option key={m.model} value={m.model}>{m.model}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Trim {loadingTrims && '⏳'}</label>
                <select className="input-field" value={newVehicle.submodel || ''}
                  disabled={!newVehicle.model}
                  onChange={e => {
                    const trim = e.target.value;
                    setNewVehicle({ ...newVehicle, submodel: trim });
                    handleTrimSelected(newVehicle.make!, newVehicle.model!, trim);
                  }}>
                  <option value="">— Select Trim —</option>
                  {trimNames.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Engine</label>
                <input className="input-field" list="vehicle-engines" value={newVehicle.engine || ''} onChange={async e => {
                  const engine = e.target.value;
                  setNewVehicle(prev => ({ ...prev, engine, drivetrain: '' }));
                  if (newVehicle.make && newVehicle.model && newVehicle.submodel) setDrivetrains(await api.getDrivetrains(newVehicle.make, newVehicle.model, newVehicle.submodel, newVehicle.year ?? undefined, engine || undefined));
                }} placeholder="From catalog" />
                <datalist id="vehicle-engines">{engines.map(v => <option key={v} value={v} />)}</datalist>
              </div>
              <div>
                <label className="label">Drivetrain</label>
                <input className="input-field" list="vehicle-drivetrains" value={newVehicle.drivetrain || ''} onChange={e => setNewVehicle(prev => ({ ...prev, drivetrain: e.target.value }))} placeholder="From catalog" />
                <datalist id="vehicle-drivetrains">{drivetrains.map(v => <option key={v} value={v} />)}</datalist>
              </div>
              <div>
                <label className="label">Transmission</label>
                <select className="input-field" value={newVehicle.transmission || ''}
                  onChange={e => setNewVehicle({ ...newVehicle, transmission: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                  <option value="CVT">CVT</option>
                  <option value="DCT">DCT</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreateVehicle} className="btn-primary text-sm"
                disabled={!newVehicle.make || !newVehicle.model}>
                Save Vehicle
              </button>
              <button onClick={() => setShowNewVehicleForm(false)} className="btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <label className="label !mb-0">📝 Notes</label>
          <button onClick={handlePolishNotes} disabled={aiProcessing} className="btn-ai text-xs">
            {aiProcessing ? '⏳ Polishing...' : '✨ Polish Text'}
          </button>
        </div>
        <textarea
          className="input-field min-h-[80px]"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (currentQuote.notes || '')) void updateQuote(currentQuote.id, { notes }); }}
          placeholder="Add notes about the quote, customer requests, or disclaimers..."
        />
      </div>

      {/* Line Items Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">📊 Line Items</h3>
          <button onClick={handleAutoCategorize} disabled={aiProcessing || lineItems.length === 0} className="btn-ai text-xs">
            {aiProcessing ? '⏳ Categorizing...' : '📊 Auto-Categorize'}
          </button>
        </div>

        {lineItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No items yet. Add parts, labor, or fees below.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Priority</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Cost</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Markup</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Qty</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">AI</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.item_type === 'part' ? 'bg-blue-100 text-blue-700' :
                      item.item_type === 'labor' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.item_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-800">{item.description}</td>
                  <td className="px-4 py-2">
                    <select
                      className="text-xs rounded border border-gray-300 bg-white px-1 py-0.5 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                      value={item.priority || ''}
                      onChange={e => { void updateLineItem(item.id, { priority: e.target.value || null }).catch(() => {}); }}
                    >
                      <option value="">—</option>
                      <option value="safety_critical">🔴 Critical</option>
                      <option value="required">🟠 Required</option>
                      <option value="recommended">🟡 Recommended</option>
                      <option value="optional">🟢 Optional</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(item.unit_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {item.item_type === 'part' ? `${item.markup_percent}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(item.line_total)}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleExplainItem(item)}
                      disabled={aiProcessing}
                      className="btn-ghost text-xs px-2 py-1"
                      title="AI Explain"
                    >
                      💡
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => { void removeLineItem(item.id).catch(() => {}); }} className="btn-ghost text-xs px-2 py-1 text-red-500 hover:bg-red-50">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Parts Search */}
      <div className="card">
        <button
          onClick={() => setShowPartsSearch(!showPartsSearch)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-semibold text-gray-900">🔍 Search Parts Online</h3>
          <span className="text-gray-400 text-sm">{showPartsSearch ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showPartsSearch && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={partsQuery}
                onChange={e => setPartsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePartsSearch()}
                placeholder="Search AutoZone, RockAuto... (e.g. brake pads Honda Accord 2018)"
              />
              <button
                onClick={handlePartsSearch}
                disabled={searching || partsQuery.trim().length < 2}
                className="btn-primary"
              >
                {searching ? '⏳ Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.map((part, i) => (
                  <div
                    key={`${part.vendor}-${part.vendor_part_id}-${i}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-brand-300 transition-colors"
                  >
                    {part.image_url && (
                      <img
                        src={part.image_url}
                        alt={part.part_name}
                        className="w-12 h-12 object-contain rounded border border-gray-200 flex-shrink-0 bg-white"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          part.vendor === 'AutoZone' ? 'bg-orange-100 text-orange-700' :
                          part.vendor === 'RockAuto' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {part.vendor}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">{part.part_name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {part.part_number && <span>PN: {part.part_number}</span>}
                        {part.brand && <span className="ml-2">Brand: {part.brand}</span>}
                      </div>
                      {part.availability && (
                        <div className="text-xs text-green-700 mt-0.5">🟢 {part.availability}</div>
                      )}
                      {part.shipping_estimate && (
                        <div className="text-xs text-blue-600 mt-0.5">🚚 {part.shipping_estimate}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-900 tabular-nums">
                        {part.price_cents > 0 ? formatCurrency(part.price_cents) : 'N/A'}
                      </div>
                      <div className="flex gap-1 mt-1 justify-end">
                        {shippingCalcs[part.vendor_part_id]?.cost != null ? (
                          <span className="text-xs text-blue-600 tabular-nums">
                            +{formatCurrency(shippingCalcs[part.vendor_part_id].cost!)}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCalcShipping(part)}
                            disabled={shippingCalcs[part.vendor_part_id]?.loading}
                            className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Estimate shipping for this part"
                          >
                            {shippingCalcs[part.vendor_part_id]?.loading ? '⏳' : '🚚 Ship'}
                          </button>
                        )}
                        <button
                          onClick={() => handleImportPart(part)}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          ➕ Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchResults.length === 0 && partsQuery.trim().length >= 2 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No parts found. Try a different search term.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add Line Item Form */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">➕ Add Line Item</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input-field" value={newItemType} onChange={e => handleTypeChange(e.target.value as any)}>
              <option value="part">Part</option>
              <option value="labor">Labor</option>
              <option value="misc">Misc</option>
              <option value="fee">Fee</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <input className="input-field" value={newDescription} onChange={e => setNewDescription(e.target.value)}
              placeholder={newItemType === 'part' ? 'Brake pads, front...' : newItemType === 'labor' ? 'Brake replacement' : 'Shop supplies'} />
          </div>
          <div>
            <label className="label">{newItemType === 'labor' ? 'Hours' : 'Qty'}</label>
            <input className="input-field" type="number" step="0.1" min="0.1" value={newQty} onChange={e => setNewQty(e.target.value)} />
          </div>
          <div>
            <label className="label">{newItemType === 'labor' ? 'Rate ($/hr)' : 'Unit Cost ($)'}</label>
            <input className="input-field" type="number" step="0.01" min="0" value={newCost} onChange={e => setNewCost(e.target.value)}
              placeholder="0.00" />
          </div>
          {newItemType === 'part' && (
            <div>
              <label className="label">Markup %</label>
              <input className="input-field" type="number" step="0.1" min="0" value={newMarkup} onChange={e => setNewMarkup(e.target.value)} />
            </div>
          )}
        </div>
        <button onClick={handleAddItem} disabled={addingItem || !newDescription.trim()} className="btn-primary mt-3">
          {addingItem ? 'Adding...' : 'Add Item'}
        </button>
      </div>

      {/* Totals Summary */}
      <div className="card ml-auto max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-3">💰 Quote Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Parts Subtotal</span>
            <span className="tabular-nums">{formatCurrency(currentQuote.parts_subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Labor</span>
            <span className="tabular-nums">{formatCurrency(currentQuote.labor_subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Misc / Fees</span>
            <span className="tabular-nums">{formatCurrency(currentQuote.misc_fees_total)}</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-600">Shop Fee</span><span className="tabular-nums">{formatCurrency(currentQuote.shop_fee_amount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Tax</span><span className="tabular-nums">{formatCurrency(currentQuote.tax_total)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span className="tabular-nums">{formatCurrency(currentQuote.shipping_total)}</span></div>
          <hr className="border-gray-200" />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(currentQuote.grand_total)}</span>
          </div>
          
          {/* Shipping Calculator */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">🚚 Shipping</span>
              {totalShipping ? (
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(totalShipping.cost)}</span>
              ) : (
                <button
                  onClick={handleCalcShippingQuote}
                  disabled={calculatingShipping}
                  className="btn-ai text-xs"
                >
                  {calculatingShipping ? '⏳ Calculating...' : '📦 Get Shipping'}
                </button>
              )}
            </div>
            {totalShipping && (
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>via {totalShipping.method}</div>
                <div>Est. delivery: {totalShipping.delivery}</div>
                {totalShipping.message && <div className="text-blue-600">{totalShipping.message}</div>}
                <button
                  onClick={handleCalcShippingQuote}
                  disabled={calculatingShipping}
                  className="text-brand-600 hover:underline mt-1"
                >
                  {calculatingShipping ? 'Recalculating...' : '🔄 Recalculate'}
                </button>
                <button
                  onClick={handlePurchaseParts}
                  disabled={calculatingShipping}
                  className="btn-primary text-xs mt-2 w-full"
                >
                  🛒 Purchase on RockAuto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </fieldset>
    </div>
  );
}
