import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAiStore } from '../../stores/aiStore';

export function AiSettingsSection() {
  const { settings, updateSettings } = useSettingsStore();
  const { testConnection, checkStatus, isChecking } = useAiStore();

  const [aiEnabled, setAiEnabled] = useState(false);
  const [lmStudioUrl, setLmStudioUrl] = useState('http://localhost:1234/v1');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; models: string[]; error?: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setAiEnabled((settings.ai_enabled as boolean) || false);
      setLmStudioUrl((settings.lmstudio_url as string) || 'http://localhost:1234/v1');
      setModel((settings.lmstudio_model as string) || '');
    }
  }, [settings]);

  async function saveAiSettings() {
    await updateSettings({
      ai_enabled: aiEnabled,
      lmstudio_url: lmStudioUrl,
      lmstudio_model: model,
    });
    if (aiEnabled) {
      checkStatus();
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    // Save URL first so test uses current config
    await updateSettings({
      lmstudio_url: lmStudioUrl,
      lmstudio_model: model,
      ai_enabled: true,
    });
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
  }

  return (
    <div className="card">
      <h3 className="section-title mb-4">Local AI Assistant (LM Studio)</h3>

      <div className="space-y-4">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={e => setAiEnabled(e.target.checked)}
            className="w-5 h-5 rounded border-line-strong dark:border-gray-600 text-brand-600 dark:text-brand-400 focus:ring-brand-500"
          />
          <div>
            <span className="text-sm font-medium text-ink">Enable Local AI Features</span>
            <p className="text-xs text-ink-subtle">Requires LM Studio running locally with a loaded model</p>
          </div>
        </label>

        {/* URL */}
        <div>
          <label className="label">LM Studio Server URL</label>
          <input
            className="input-field font-mono text-sm"
            value={lmStudioUrl}
            onChange={e => setLmStudioUrl(e.target.value)}
            placeholder="http://localhost:1234/v1"
          />
          <p className="text-xs text-ink-subtle dark:text-gray-500 mt-1">Default LM Studio OpenAI-compatible endpoint</p>
        </div>

        {/* Model */}
        <div>
          <label className="label">Model</label>
          <div className="flex gap-2">
            <input
              className="input-field font-mono text-sm flex-1"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="Auto-detect (leave empty)"
            />
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn-secondary whitespace-nowrap"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
          {model && <p className="text-xs text-ink-subtle dark:text-gray-500 mt-1">Using: {model}</p>}
          {!model && <p className="text-xs text-ink-subtle dark:text-gray-500 mt-1">Leave empty to auto-detect model on first connection</p>}
        </div>

        {/* Test result */}
        {testResult && (
          <div className={testResult.ok ? 'alert-success' : 'alert-error'}>
            {testResult.ok ? (
              <>
                <p className="font-medium">Connection successful</p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  {testResult.models.length} model{testResult.models.length !== 1 ? 's' : ''} found:
                  {' '}{testResult.models.join(', ')}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Connection failed</p>
                <p className="text-red-700 dark:text-red-300 mt-1">{testResult.error}</p>
                <p className="text-red-600 dark:text-red-400 mt-2 text-xs">
                  Make sure LM Studio is running and the local server is started on port 1234.
                </p>
              </>
            )}
          </div>
        )}

        <button onClick={saveAiSettings} className="btn-primary">
          Save AI Settings
        </button>
      </div>
    </div>
  );
}