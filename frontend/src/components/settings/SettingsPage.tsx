import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAiStore } from '../../stores/aiStore';
import { AiSettingsSection } from './AiSettingsSection';

export function SettingsPage() {
  const { settings, profile, isLoading, updateSettings, updateProfile, uploadLogo, loadSettings, loadProfile } = useSettingsStore();
  const { checkStatus } = useAiStore();

  const [laborRate, setLaborRate] = useState('120.00');
  const [taxRate, setTaxRate] = useState('8.25');
  const [shopFeePercent, setShopFeePercent] = useState('5');
  const [shopFeeCap, setShopFeeCap] = useState('50.00');
  const [disposalFee, setDisposalFee] = useState('3.00');
  const [defaultMarkup, setDefaultMarkup] = useState('30');
  const [taxParts, setTaxParts] = useState(true);
  const [taxLabor, setTaxLabor] = useState(true);

  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopStreet, setShopStreet] = useState('');
  const [shopCity, setShopCity] = useState('');
  const [shopState, setShopState] = useState('');
  const [shopProfileZip, setShopProfileZip] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [shopWebsite, setShopWebsite] = useState('');
  const [shopZipCode, setShopZipCode] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Track initial sync to prevent overwriting user edits from subsequent settings reloads
  const initSettingsDone = useRef(false);
  const initProfileDone = useRef(false);

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0 && !initSettingsDone.current) {
      initSettingsDone.current = true;
      const labor = settings.labor_rate as number;
      const tax = settings.tax_rate as number;
      const feePct = settings.shop_fee_percent as number;
      const feeCap = settings.shop_fee_cap as number;
      const disp = settings.disposal_fee as number;
      const markup = settings.markup_default as number;
      setLaborRate(String((labor ?? 12000) / 100));
      setTaxRate(String(tax ?? 8.25));
      setShopFeePercent(String(feePct ?? 5));
      setShopFeeCap(String((feeCap ?? 5000) / 100));
      setDisposalFee(String((disp ?? 300) / 100));
      setDefaultMarkup(String(markup ?? 30));
      setTaxParts((settings.tax_applies_to_parts as boolean) ?? true);
      setTaxLabor((settings.tax_applies_to_labor as boolean) ?? true);
      // ZIP is now in profile, synced on save
      setShopZipCode(String(settings.shop_zip_code ?? ''));
      setSmtpHost(String(settings.smtp_host ?? ''));
      setSmtpPort(String(settings.smtp_port ?? 587));
      setSmtpUser(String(settings.smtp_user ?? ''));
      setSmtpFrom(String(settings.smtp_from ?? ''));
      setSmtpSecure(Boolean(settings.smtp_secure));
    }
  }, [settings]);

  useEffect(() => {
    if (profile && !initProfileDone.current) {
      initProfileDone.current = true;
      setShopName(profile.shop_name || '');
      setShopAddress(profile.address || '');
      setShopStreet(profile.address_street || '');
      setShopCity(profile.address_city || '');
      setShopState(profile.address_state || '');
      setShopProfileZip(profile.address_zip || '');
      setShopPhone(profile.phone || '');
      setShopEmail(profile.email || '');
      setShopWebsite(profile.website || '');
    }
  }, [profile]);

  async function savePricing() {
    setSaving(true);
    setMessage(null);
    try {
      const rawValues = [
        laborRate, taxRate, shopFeePercent, shopFeeCap, disposalFee, defaultMarkup,
      ];
      if (rawValues.some(value => value.trim() === '')) {
        setMessage({ type: 'error', text: 'All pricing fields require a value.' });
        return;
      }
      const parsed = {
        labor_rate: Math.round(Number(laborRate) * 100),
        tax_rate: Number(taxRate),
        shop_fee_percent: Number(shopFeePercent),
        shop_fee_cap: Math.round(Number(shopFeeCap) * 100),
        disposal_fee: Math.round(Number(disposalFee) * 100),
        markup_default: Number(defaultMarkup),
      };
      if (
        !Object.values(parsed).every(Number.isFinite) ||
        parsed.labor_rate < 0 ||
        parsed.tax_rate < 0 || parsed.tax_rate > 100 ||
        parsed.shop_fee_percent < 0 || parsed.shop_fee_percent > 100 ||
        parsed.shop_fee_cap < 0 ||
        parsed.disposal_fee < 0 ||
        parsed.markup_default < 0 || parsed.markup_default > 1000
      ) {
        setMessage({ type: 'error', text: 'Enter valid pricing values within the displayed ranges.' });
        return;
      }
      await updateSettings({
        ...parsed,
        tax_applies_to_parts: taxParts,
        tax_applies_to_labor: taxLabor,
      });
      setMessage({ type: 'success', text: 'Pricing settings saved ✓' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        shop_name: shopName,
        address_street: shopStreet,
        address_city: shopCity,
        address_state: shopState,
        address_zip: shopProfileZip,
        phone: shopPhone,
        email: shopEmail,
        website: shopWebsite,
      });
      // Also save the parts search zip to settings if provided
      if (shopProfileZip.trim()) {
        await updateSettings({ shop_zip_code: shopProfileZip });
      }
      setMessage({ type: 'success', text: 'Shop profile saved ✓' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function saveEmail() {
    const port = Number(smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setMessage({ type: 'error', text: 'Enter a valid SMTP port.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings({ smtp_host: smtpHost.trim(), smtp_port: port, smtp_user: smtpUser.trim(),
        smtp_from: smtpFrom.trim(), smtp_secure: smtpSecure, ...(smtpPass ? { smtp_pass: smtpPass } : {}) });
      setSmtpPass('');
      setMessage({ type: 'success', text: 'Email settings saved ✓' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save email settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadLogo(file);
    if (path) {
      setMessage({ type: 'success', text: 'Logo uploaded ✓' });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (isLoading && !settings) {
    return <div className="card animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="page-title">Settings</h2>

      {message && (
        <div className={message.type === 'success' ? 'alert-success' : 'alert-error'} role="status">
          {message.text}
        </div>
      )}

      {/* ── Shop Profile ── */}
      <div className="card">
        <h3 className="section-title mb-4">Shop Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Shop Name</label>
            <input className="input-field" value={shopName} onChange={e => setShopName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Street Address</label>
            <input className="input-field" value={shopStreet} onChange={e => setShopStreet(e.target.value)}
              placeholder="123 Main St" />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input-field" value={shopCity} onChange={e => setShopCity(e.target.value)}
              placeholder="Indianapolis" />
          </div>
          <div>
            <label className="label">State</label>
            <select className="input-field" value={shopState} onChange={e => setShopState(e.target.value)}>
              <option value="">—</option>
              {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ZIP Code</label>
            <input className="input-field" value={shopProfileZip} onChange={e => setShopProfileZip(e.target.value)}
              placeholder="46201" maxLength={10} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={shopPhone} onChange={e => setShopPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={shopEmail} onChange={e => setShopEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input-field" value={shopWebsite} onChange={e => setShopWebsite(e.target.value)} />
          </div>
          <div>
            <label className="label">Shop Logo</label>
            <div className="flex items-center gap-3">
              {profile?.logo_path ? (
                <img src={profile.logo_path} alt="Logo" className="h-12 w-12 rounded-lg object-contain bg-surface-muted dark:bg-gray-800" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-ink-subtle dark:text-gray-500 text-xs">No Logo</div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="text-sm text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 dark:file:bg-brand-950 dark:bg-brand-950 file:text-brand-700 dark:file:text-brand-300 dark:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900"
              />
            </div>
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="btn-primary mt-4">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* ── Pricing Defaults ── */}
      <div className="card">
        <h3 className="section-title mb-4">Pricing Defaults</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Labor Rate ($/hr)</label>
            <input className="input-field" type="number" step="0.01" min="0" value={laborRate} onChange={e => setLaborRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Sales Tax (%)</label>
            <input className="input-field" type="number" step="0.01" min="0" max="100" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Default Markup (%)</label>
            <input className="input-field" type="number" step="0.1" min="0" value={defaultMarkup} onChange={e => setDefaultMarkup(e.target.value)} />
          </div>
          <div>
            <label className="label">Shop Fee (%)</label>
            <input className="input-field" type="number" step="0.1" min="0" max="100" value={shopFeePercent} onChange={e => setShopFeePercent(e.target.value)} />
          </div>
          <div>
            <label className="label">Shop Fee Cap ($)</label>
            <input className="input-field" type="number" step="0.01" min="0" value={shopFeeCap} onChange={e => setShopFeeCap(e.target.value)} />
          </div>
          <div>
            <label className="label">Disposal Fee ($)</label>
            <input className="input-field" type="number" step="0.01" min="0" value={disposalFee} onChange={e => setDisposalFee(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-gray-200">
            <input type="checkbox" checked={taxParts} onChange={e => setTaxParts(e.target.checked)} className="rounded border-line-strong dark:border-gray-600 text-brand-600 dark:text-brand-400 focus:ring-brand-500" />
            Tax applies to parts
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-gray-200">
            <input type="checkbox" checked={taxLabor} onChange={e => setTaxLabor(e.target.checked)} className="rounded border-line-strong dark:border-gray-600 text-brand-600 dark:text-brand-400 focus:ring-brand-500" />
            Tax applies to labor
          </label>
        </div>
        <button onClick={savePricing} disabled={saving} className="btn-primary mt-4">
          {saving ? 'Saving...' : 'Save Pricing'}
        </button>
      </div>

      <div className="card">
        <h3 className="section-title mb-4">Email</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">SMTP Host</label><input className="input-field" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} /></div>
          <div><label className="label">SMTP Port</label><input className="input-field" type="number" min="1" max="65535" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} /></div>
          <div><label className="label">Username</label><input className="input-field" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} autoComplete="username" /></div>
          <div><label className="label">Password</label><input className="input-field" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder={settings.smtp_pass_configured ? 'Leave blank to keep saved password' : ''} autoComplete="new-password" /></div>
          <div><label className="label">From Address</label><input className="input-field" type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={smtpSecure} onChange={e => setSmtpSecure(e.target.checked)} /> Use secure connection</label>
        </div>
        <button onClick={saveEmail} disabled={saving} className="btn-primary mt-4">{saving ? 'Saving...' : 'Save Email'}</button>
      </div>

      {/* ── AI Settings ── */}
      <AiSettingsSection />
    </div>
  );
}
