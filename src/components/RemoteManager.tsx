import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Bell, BellOff, Clock, Server, Activity, PlayCircle, XCircle, Plus, X, Calendar } from 'lucide-react';

// Get auth token
const token = () => localStorage.getItem('am-token') || '';
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

// Make a request to Alertmanager API directly
async function amFetch(targetUrl: string, path: string, options: RequestInit = {}) {
  const url = `${targetUrl.replace(/\/$/, "")}${path}`;
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
}

interface AlertItem {
  fingerprint: string;
  startsAt: string;
  updatedAt: string;
  endsAt: string;
  status: { state: string; silencedBy: string[]; inhibitedBy: string[] };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  generatorURL: string;
}

interface SilenceItem {
  id: string;
  status: { state: string };
  startsAt: string;
  endsAt: string;
  matchers: { name: string; value: string; isRegex: boolean }[];
  createdBy: string;
  comment: string;
}

export default function RemoteManager({ targetUrl }: { targetUrl: string }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'alerts' | 'silences' | 'status'>('alerts');

  // Alerts
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');

  // Silences
  const [silences, setSilences] = useState<SilenceItem[]>([]);
  const [silencesLoading, setSilencesLoading] = useState(false);
  const [silencesError, setSilencesError] = useState('');
  const [showSilenceForm, setShowSilenceForm] = useState(false);
  const [newMatchers, setNewMatchers] = useState<{ name: string; value: string; isRegex: boolean }[]>([{ name: '', value: '', isRegex: false }]);
  const [newComment, setNewComment] = useState('');
  const [newCreatedBy, setNewCreatedBy] = useState('');
  const [newDuration, setNewDuration] = useState('2h');
  const [createLoading, setCreateLoading] = useState(false);

  // Status
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const res = await amFetch(targetUrl, '/api/v2/alerts');
      const data = await res.json();
      if (res.ok) setAlerts(data || []);
      else setAlertsError(data.error || 'Failed to fetch');
    } catch { setAlertsError('Network error'); }
    finally { setAlertsLoading(false); }
  };

  const fetchSilences = async () => {
    setSilencesLoading(true);
    setSilencesError('');
    try {
      const res = await amFetch(targetUrl, '/api/v2/silences');
      const data = await res.json();
      if (res.ok) setSilences(data || []);
      else setSilencesError(data.error || 'Failed to fetch');
    } catch { setSilencesError('Network error'); }
    finally { setSilencesLoading(false); }
  };

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await amFetch(targetUrl, '/api/v2/status');
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {}
    finally { setStatusLoading(false); }
  };

  const handleExpireSilence = async (id: string) => {
    try {
      await amFetch(targetUrl, `/api/v2/silence/${id}`, { method: 'DELETE' });
      fetchSilences();
    } catch {}
  };

  const handleCreateSilence = async () => {
    setCreateLoading(true);
    try {
      const startsAt = new Date();
      const hours = parseFloat(newDuration) || 2;
      const endsAt = new Date(startsAt.getTime() + hours * 3600000);

      const res = await amFetch(targetUrl, '/api/v2/silences', {
        method: 'POST',
        body: JSON.stringify({
          matchers: newMatchers.filter(m => m.name && m.value),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          createdBy: newCreatedBy || 'admin',
          comment: newComment || 'Silence via Configurer',
        }),
      });
      if (res.ok) {
        setShowSilenceForm(false);
        setNewMatchers([{ name: '', value: '', isRegex: false }]);
        setNewComment('');
        fetchSilences();
      }
    } catch {}
    finally { setCreateLoading(false); }
  };

  useEffect(() => { fetchAlerts(); }, []);
  useEffect(() => { if (subTab === 'silences') fetchSilences(); }, [subTab]);
  useEffect(() => { if (subTab === 'status') fetchStatus(); }, [subTab]);

  const stateBadge = (state: string) => {
    const map: Record<string, string> = {
      active: 'bg-red-50 text-red-700 border-red-200',
      suppressed: 'bg-amber-50 text-amber-700 border-amber-200',
      unprocessed: 'bg-blue-50 text-blue-700 border-blue-200',
      expired: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return map[state] || 'bg-gray-50 text-gray-500 border-gray-200';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 shrink-0">
        {(['alerts', 'silences', 'status'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'alerts' && <><Bell className="w-3.5 h-3.5 inline mr-1" />Alerts</>}
            {tab === 'silences' && <><BellOff className="w-3.5 h-3.5 inline mr-1" />Silences</>}
            {tab === 'status' && <><Activity className="w-3.5 h-3.5 inline mr-1" />Status</>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* === Alerts === */}
        {subTab === 'alerts' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">
                {alertsLoading ? 'Loading...' : `${alerts.length} active alert(s)`}
              </span>
              <button onClick={fetchAlerts} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">
                <RefreshCw className={`w-3 h-3 ${alertsLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {alertsError && <p className="text-xs text-red-500 mb-3">{alertsError}</p>}
            <div className="space-y-2">
              {alerts.map(alert => {
                const alertname = alert.labels?.alertname || alert.labels?.__name__ || 'Unknown';
                const severity = alert.labels?.severity || '';
                const state = alert.status?.state || 'unprocessed';
                return (
                  <div key={alert.fingerprint} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${stateBadge(state)}`}>
                            {state.toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 truncate">{alertname}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {severity && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                              severity={severity}
                            </span>
                          )}
                          {Object.entries(alert.labels || {}).filter(([k]) => !['alertname', 'severity', '__name__'].includes(k)).slice(0, 5).map(([k, v]) => (
                            <span key={k} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] font-mono">
                              {k}={v}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          Since: {new Date(alert.startsAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!alertsLoading && alerts.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <CheckIcon className="w-10 h-10 mx-auto mb-2 text-green-200" />
                  <span className="text-sm">No active alerts</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Silences === */}
        {subTab === 'silences' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{silences.length} silence(s)</span>
              <div className="flex gap-2">
                <button onClick={fetchSilences} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
                <button onClick={() => setShowSilenceForm(!showSilenceForm)} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded">
                  <Plus className="w-3 h-3" /> New Silence
                </button>
              </div>
            </div>
            {silencesError && <p className="text-xs text-red-500 mb-3">{silencesError}</p>}

            {/* Create silence form */}
            {showSilenceForm && (
              <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" placeholder="Created by" value={newCreatedBy} onChange={e => setNewCreatedBy(e.target.value)} className="text-xs p-2 border rounded" />
                    <input type="text" placeholder="Comment" value={newComment} onChange={e => setNewComment(e.target.value)} className="text-xs p-2 border rounded" />
                    <select value={newDuration} onChange={e => setNewDuration(e.target.value)} className="text-xs p-2 border rounded bg-white">
                      <option value="1">1h</option><option value="2">2h</option><option value="4">4h</option><option value="8">8h</option><option value="24">24h</option><option value="48">48h</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    {newMatchers.map((m, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="text" placeholder="label" value={m.name} onChange={e => { const u = [...newMatchers]; u[idx] = { ...u[idx], name: e.target.value }; setNewMatchers(u); }} className="flex-1 text-xs p-1.5 border rounded font-mono" />
                        <select value={m.isRegex ? '=~' : '='} onChange={e => { const u = [...newMatchers]; u[idx] = { ...u[idx], isRegex: e.target.value === '=~' }; setNewMatchers(u); }} className="text-xs p-1.5 border rounded bg-white">
                          <option value="=">=</option><option value="=~">=~</option>
                        </select>
                        <input type="text" placeholder="value" value={m.value} onChange={e => { const u = [...newMatchers]; u[idx] = { ...u[idx], value: e.target.value }; setNewMatchers(u); }} className="flex-1 text-xs p-1.5 border rounded font-mono" />
                        {newMatchers.length > 1 && <button onClick={() => setNewMatchers(newMatchers.filter((_, i) => i !== idx))} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
                      </div>
                    ))}
                    <button onClick={() => setNewMatchers([...newMatchers, { name: '', value: '', isRegex: false }])} className="text-xs text-blue-600 font-semibold">+ Add matcher</button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowSilenceForm(false)} className="px-3 py-1.5 text-xs border rounded">Cancel</button>
                    <button onClick={handleCreateSilence} disabled={createLoading} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50">
                      {createLoading ? 'Creating...' : 'Create Silence'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {silences.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${s.status.state === 'active' ? 'bg-blue-50 text-blue-700 border-blue-200' : s.status.state === 'expired' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {s.status.state.toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">{s.createdBy || 'Unknown'}: {s.comment}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.matchers.map((m, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-mono">
                            {m.name}{m.isRegex ? '=~' : '='}{m.value}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(s.startsAt).toLocaleString()} - {new Date(s.endsAt).toLocaleString()}
                      </p>
                    </div>
                    {s.status.state !== 'expired' && (
                      <button onClick={() => handleExpireSilence(s.id)} className="text-xs text-red-500 hover:text-red-600 font-semibold whitespace-nowrap ml-2">Expire</button>
                    )}
                  </div>
                </div>
              ))}
              {silences.length === 0 && !silencesLoading && (
                <div className="text-center py-16 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <span className="text-sm">No active silences</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Status === */}
        {subTab === 'status' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">Cluster Status</span>
              <button onClick={fetchStatus} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">
                <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {status ? (
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-500" /> Version
                  </h4>
                  <p className="text-xs font-mono text-gray-800">{status?.versionInfo?.version || 'Unknown'}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Uptime
                  </h4>
                  <p className="text-xs font-mono text-gray-800">{status?.cluster?.status || 'ready'}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Server className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <span className="text-sm">{statusLoading ? 'Loading...' : 'No status data'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple checkmark icon
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
