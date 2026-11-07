import { Link, useLocation } from 'react-router-dom';
import { AiStatusIndicator } from '../ai/AiStatusIndicator';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeStore } from '../../stores/themeStore';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const { profile, settings } = useSettingsStore();
  const { theme, toggleTheme } = useThemeStore();

  const shopName = (profile?.shop_name as string) || 'AutoQuotes Free';
  const logoPath = profile?.logo_path as string | undefined;
  const aiEnabled = settings.ai_enabled as boolean | undefined;

  const navLinks = [
    { to: '/quotes', label: 'Quotes', match: (path: string) => path === '/quotes' || (path.startsWith('/quotes/') && path !== '/quotes/new') },
    { to: '/jobs', label: 'Jobs', match: (path: string) => path.startsWith('/jobs') },
    { to: '/billing', label: 'Billing', match: (path: string) => path.startsWith('/billing') },
    { to: '/customers', label: 'Customers', match: (path: string) => path.startsWith('/customers') },
    { to: '/quotes/new', label: 'New Quote', match: (path: string) => path === '/quotes/new' },
    { to: '/settings', label: 'Settings', match: (path: string) => path.startsWith('/settings') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-surface-elevated/95 backdrop-blur supports-[backdrop-filter]:bg-surface-elevated/80 shadow-sm dark:border-gray-800 dark:bg-gray-950/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link to="/" className="flex items-center gap-3 shrink-0 min-w-0">
              {logoPath ? (
                <img
                  src={logoPath}
                  alt={shopName}
                  className="h-10 w-10 rounded-lg object-contain bg-surface-muted dark:bg-gray-900"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  AR
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-ink leading-tight truncate">{shopName}</h1>
                <p className="text-xs text-ink-subtle">Repair Quote Manager</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
              {navLinks.map(link => {
                const active = link.match(location.pathname);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`nav-link ${active ? 'nav-link-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {aiEnabled && <AiStatusIndicator />}
              <button
                type="button"
                onClick={toggleTheme}
                className="theme-toggle"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden flex items-center gap-1 px-4 py-2 bg-surface-elevated border-b border-line overflow-x-auto dark:border-gray-800" aria-label="Mobile">
        {navLinks.map(link => {
          const active = link.match(location.pathname);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link shrink-0 ${active ? 'nav-link-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      <footer className="border-t border-line bg-surface-elevated py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-ink-subtle">
          AutoQuotes Free v1.0.0 · Linux · Local workstation
        </div>
      </footer>
    </div>
  );
}
