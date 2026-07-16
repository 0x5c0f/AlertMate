
import React, { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { AlertmanagerState, AlertmanagerConfig, Silence, Route, Receiver, InhibitRule } from './types';
import ReceiverManager from './components/ReceiverManager';
import RouteManager from './components/RouteManager';
import InhibitRuleManager from './components/InhibitRuleManager';
import SilenceManager from './components/SilenceManager';
import ValidationAndReload from './components/ValidationAndReload';
import AiCopilot from './components/AiCopilot';
import RemoteManager from './components/RemoteManager';
import {
  Settings,
  GitBranch,
  ShieldAlert,
  VolumeX,
  FileCheck,
  Sparkles,
  HelpCircle,
  Layers,
  Radio,
  Clock,
  Sun,
  Moon,
  Languages,
  KeyRound,
  LogOut,
  Satellite
} from 'lucide-react';

export default function App() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<AlertmanagerState | null>(null);
  const [activeTab, setActiveTab] = useState<'receivers' | 'routes' | 'inhibit' | 'silences' | 'deploy' | 'copilot' | 'remote'>(() => {
    return (localStorage.getItem('alertmanager-tab') as any) || 'receivers';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('alertmanager-theme') as 'dark' | 'light') || 'dark';
  });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [alertCount, setAlertCount] = useState<number | null>(null);

  // Sync activeTab with localStorage
  useEffect(() => {
    localStorage.setItem('alertmanager-tab', activeTab);
  }, [activeTab]);

  // Sync theme with document.body and localStorage
  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('alertmanager-theme', theme);
  }, [theme]);

  // Load state on mount — localStorage first, server default as fallback
  useEffect(() => {
    const saved = localStorage.getItem('am-config-state');
    if (saved) {
      try { setState(JSON.parse(saved)); } catch {}
    }
    const fetchDefault = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setState(prev => prev || data);
        }
      } catch {}
    };
    fetchDefault();
    fetch('/api/ai/config').then(r => r.json()).then(c => setAiEnabled(c.enabled)).catch(() => {});
    fetchAuthStatus();
  }, []);

  // Sync config state to localStorage whenever it changes
  useEffect(() => {
    if (state) localStorage.setItem('am-config-state', JSON.stringify(state));
  }, [state]);

  const fetchAuthStatus = () => {
    fetch('/api/auth/status', {
      headers: { Authorization: `Bearer ${localStorage.getItem('am-token') || ''}` }
    })
      .then(r => r.json())
      .then(s => {
        setAuthEnabled(s.authEnabled);
        setAuthenticated(s.authenticated);
        if (s.authenticated && s.authEnabled) setAiEnabled(s.aiEnabled);
      })
      .catch(() => {});
  };

  // Fetch alert count when authenticated and state is loaded
  useEffect(() => {
    if (authenticated && state) {
      const url = state.targetAlertmanagerUrl?.replace(/\/$/, '') || 'http://localhost:9093';
      fetch(`${url}/api/v2/alerts`)
        .then(r => r.json())
        .then(alerts => setAlertCount(Array.isArray(alerts) ? alerts.length : null))
        .catch(() => setAlertCount(null));
    } else {
      setAlertCount(null);
    }
  }, [authenticated, state?.targetAlertmanagerUrl]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('am-token', data.token);
        setLoginPassword('');
        setShowLogin(false);
        fetchAuthStatus();
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch {
      setLoginError('Network error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('am-token');
    fetchAuthStatus();
  };


  if (!state) {
    const isDark = theme === 'dark';
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 bg-dots ${isDark ? 'bg-[#050505] text-gray-300' : 'bg-gray-50 text-gray-800'}`}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <Clock className="w-10 h-10 text-amber-500 animate-spin" />
          <div className="text-center space-y-2">
            <span className={`text-sm font-semibold block tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('app.loading')}</span>
            <span className={`text-xs block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('app.loadingSub')}</span>
          </div>
        </div>
      </div>
    );
  }

  // State Change Updaters
  const handleReceiversChange = (receivers: Receiver[]) => {
    setState(prev => prev ? { ...prev, config: { ...prev.config, receivers } } : null);
  };

  const handleRouteTreeChange = (route: Route) => {
    setState(prev => prev ? { ...prev, config: { ...prev.config, route } } : null);
  };

  const handleInhibitRulesChange = (inhibit_rules: InhibitRule[]) => {
    setState(prev => prev ? { ...prev, config: { ...prev.config, inhibit_rules } } : null);
  };

  const handleSilencesChange = (silences: Silence[]) => {
    setState(prev => prev ? { ...prev, silences } : null);
  };

  const handleTargetUrlChange = (targetAlertmanagerUrl: string) => {
    setState(prev => prev ? { ...prev, targetAlertmanagerUrl } : null);
  };

  // Pull config from remote Alertmanager and apply
  const handlePullConfig = (pulledConfig: AlertmanagerConfig) => {
    setState(prev => prev ? { ...prev, config: pulledConfig } : null);
  };

  // AI Copilot Integration handler - bulk updates config components
  const handleApplyAiSuggestions = (suggestions: {
    receivers?: Receiver[];
    route?: Route;
    inhibit_rules?: InhibitRule[];
  }) => {
    setState(prev => {
      if (!prev) return null;
      const updatedConfig = { ...prev.config };
      if (suggestions.receivers) updatedConfig.receivers = suggestions.receivers;
      if (suggestions.route) updatedConfig.route = suggestions.route;
      if (suggestions.inhibit_rules) updatedConfig.inhibit_rules = suggestions.inhibit_rules;
      return { ...prev, config: updatedConfig };
    });
  };

  // Counting helpers for stats header
  const getRouteCount = (r: Route): number => {
    let count = 1;
    if (r.routes) {
      r.routes.forEach(sub => {
        count += getRouteCount(sub);
      });
    }
    return count;
  };

  const totalRoutes = getRouteCount(state.config.route);
  const activeSilencesCount = state.silences.filter(s => {
    const now = new Date();
    return now >= new Date(s.startsAt) && now <= new Date(s.endsAt);
  }).length;

  return (
    <div className={`min-h-screen flex flex-col font-sans bg-dots transition-colors duration-200 ${theme === 'dark' ? 'bg-[#09090b] text-gray-300' : 'bg-[#fafafa] text-gray-800'}`}>
      {/* Top Navbar */}
      <header className={`border-b sticky top-0 z-50 px-6 py-4 backdrop-blur-md transition-colors duration-200 ${theme === 'dark' ? 'bg-[#0c0c0e]/90 border-white/10 text-white' : 'bg-white/90 border-gray-200 text-gray-900'}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Brand Logo Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-md shadow-amber-500/10">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <Trans
                    i18nKey="app.title"
                    components={{ accent: <span className="text-amber-500" /> }}
                  />
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20 uppercase tracking-widest font-bold">
                  {t('app.badge')}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('app.subtitle')}
              </p>
            </div>
          </div>

          {/* Quick status counters */}
          <div className={`flex items-center gap-4 text-xs font-medium self-start sm:self-center p-2.5 rounded-lg border transition-colors duration-200 ${theme === 'dark' ? 'text-gray-400 bg-[#141416] border-white/10' : 'text-gray-600 bg-gray-50 border-gray-200'}`}>
            <div className={`flex items-center gap-1.5 pr-3 border-r ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              <span>{t('app.receivers')}: <strong className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{state.config.receivers.length}</strong></span>
            </div>
            <div className={`flex items-center gap-1.5 pr-3 border-r ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              <span>{t('app.routes')}: <strong className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{totalRoutes}</strong></span>
            </div>
            {alertCount !== null && (
            <div className={`flex items-center gap-1.5 pr-3 border-r ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Alerts: <strong className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{alertCount}</strong></span>
            </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <span>{t('app.activeSilences')}: <strong className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{activeSilencesCount}</strong></span>
            </div>
          </div>

          {/* Manual Save Button, Theme Toggle & Storage Info */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            
            {/* Language Toggle */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-amber-400'
                  : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-amber-600'
              }`}
              title={t('app.langSwitch')}
            >
              <Languages className="w-4 h-4" />
            </button>

            {/* Login/Logout */}
            {authEnabled && (
              authenticated ? (
                <button
                  onClick={handleLogout}
                  className={`p-2 rounded-lg border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-600'
                  }`}
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className={`p-2 rounded-lg border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-amber-400'
                      : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-amber-600'
                  }`}
                  title="Login"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              )
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-amber-400'
                  : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-amber-600'
              }`}
              title={theme === 'dark' ? t('app.themeSwitchDark') : t('app.themeSwitchLight')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Navigation Tabs Bar */}
        <div className={`border rounded-xl p-1.5 flex flex-wrap gap-1 shadow-sm shrink-0 transition-colors duration-200 ${theme === 'dark' ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => setActiveTab('receivers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'receivers'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            📋 {t('app.tabs.receivers')}
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'routes'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            🌲 {t('app.tabs.routingTree')}
          </button>
          <button
            onClick={() => setActiveTab('inhibit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'inhibit'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            🚫 {t('app.tabs.inhibitRules')}
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'deploy'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            ✅ {t('app.tabs.validateDeploy')}
          </button>
          {authenticated && (
          <button
            onClick={() => setActiveTab('remote')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'remote'
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Satellite className="w-4 h-4" />
            🛰 Remote Ops
          </button>
          )}
          {aiEnabled && authenticated && (
          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'copilot'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm'
                : theme === 'dark'
                  ? 'text-amber-500/60 hover:text-amber-400 hover:bg-white/5 border border-transparent'
                  : 'text-amber-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            🔮 {t('app.tabs.aiCopilot')}
          </button>
          )}
        </div>

        {/* Dynamic Tab Workspace View */}
        <div className="flex-1 min-h-0">
          {activeTab === 'receivers' && (
            <ReceiverManager
              receivers={state.config.receivers}
              onChange={handleReceiversChange}
            />
          )}

          {activeTab === 'routes' && (
            <RouteManager
              route={state.config.route}
              receivers={state.config.receivers}
              onChange={handleRouteTreeChange}
            />
          )}

          {activeTab === 'inhibit' && (
            <InhibitRuleManager
              inhibitRules={state.config.inhibit_rules || []}
              onChange={handleInhibitRulesChange}
            />
          )}

          {activeTab === 'deploy' && (
            <ValidationAndReload
              config={state.config}
              targetUrl={state.targetAlertmanagerUrl}
              onTargetUrlChange={handleTargetUrlChange}
              onPullConfig={handlePullConfig}
              authenticated={authenticated}
            />
          )}

          {activeTab === 'copilot' && aiEnabled && (
            <AiCopilot
              currentConfig={state.config}
              onApplySuggestions={handleApplyAiSuggestions}
            />
          )}

          {activeTab === 'remote' && authenticated && (
            <RemoteManager targetUrl={state.targetAlertmanagerUrl} />
          )}
        </div>
      </main>

      {/* Humble Footer */}
      <footer className={`border-t py-4 text-center shrink-0 transition-colors duration-200 ${theme === 'dark' ? 'bg-[#09090b] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
        <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('app.footer')}
        </span>
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative bg-white dark:bg-[#1a1a1e] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Admin Login</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Password"
                autoFocus
                className="w-full text-sm p-2.5 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 outline-none focus:ring-1 focus:ring-blue-500"
              />
              {loginError && <p className="text-xs text-red-500">{loginError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
              <button onClick={() => setShowLogin(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">Cancel</button>
              <button onClick={handleLogin} disabled={loginLoading} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
