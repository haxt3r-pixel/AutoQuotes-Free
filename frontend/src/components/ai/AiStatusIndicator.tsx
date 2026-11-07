import { useEffect } from 'react';
import { useAiStore } from '../../stores/aiStore';

export function AiStatusIndicator() {
  const { status, isChecking, checkStatus, pollStatus, stopPolling } = useAiStore();

  useEffect(() => {
    checkStatus();
    pollStatus();
    return () => stopPolling();
  }, []);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-subtle dark:text-gray-500">
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        <span className="hidden sm:inline">AI Checking...</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300" title="LM Studio connected">
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-300" />
        <span className="hidden sm:inline font-medium">AI Ready</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => checkStatus()}
      disabled={isChecking}
      className="flex items-center gap-2 text-sm text-ink-subtle hover:text-ink-muted dark:text-gray-200 transition-colors"
      title={status.error || 'LM Studio disconnected — click to retry'}
    >
      <div className="w-2 h-2 rounded-full bg-gray-400" />
      <span className="hidden sm:inline">
        {isChecking ? 'Checking...' : 'AI Offline'}
      </span>
    </button>
  );
}