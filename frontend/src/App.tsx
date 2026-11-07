import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { QuoteBuilder } from './components/quotes/QuoteBuilder';
import { QuotesList } from './components/quotes/QuotesList';
import { SettingsPage } from './components/settings/SettingsPage';
import { CustomersPage } from './components/customers/CustomersPage';
import { JobsList } from './components/jobs/JobsList';
import { JobDetail } from './components/jobs/JobDetail';
import { BillingList } from './components/billing/BillingList';
import { BillingDetail } from './components/billing/BillingDetail';
import { useSettingsStore } from './stores/settingsStore';
import { useAiStore } from './stores/aiStore';

export default function App() {
  const { loadSettings, loadProfile, settings } = useSettingsStore();
  const { pollStatus, stopPolling } = useAiStore();

  useEffect(() => {
    loadSettings();
    loadProfile();
  }, []);

  // Start/stop AI polling based on ai_enabled setting
  useEffect(() => {
    const aiEnabled = settings.ai_enabled;
    if (aiEnabled) {
      pollStatus();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [settings.ai_enabled]);

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/quotes" replace />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/quotes/new" element={<QuoteBuilder />} />
          <Route path="/quotes/:id" element={<QuoteBuilder />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/billing" element={<BillingList />} />
          <Route path="/billing/:id" element={<BillingDetail />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}