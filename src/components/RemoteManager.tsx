import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Bell, BellOff, Clock, Server, Activity, PlayCircle, XCircle, Plus, X, Calendar } from 'lucide-react';

// Get auth token
const token = () => localStorage.getItem('am-token') || '';

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
  const [subTab, setSubTab] = useState<'alerts' | 'silences' | 'status'>(() => {
    return (localStorage.getItem('am-subtab') as any) || 'alerts';
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');

  const [silences, setSilences] = useState<SilenceItem[]>([]);
  const [silencesLoading, setSilencesLoading] = useState(false);
  const [silencesError, setSilencesError] = useState('');
  const [showSilenceForm, setShowSilenceForm] = useState(false);
  const [newMatchers, setNewMatchers] = useState<{ name: string; value: string; isRegex: boolean }[]>([{ name: '', value: '', isRegex: false }]);
  const [newComment, setNewComment] = useState('');
  const [newCreatedBy, setNewCreatedBy] = useState('');
  const [newDuration, setNewDuration] = useState('2h');
  const [createLoading, setCreateLoading] = useState(false);
  const [editingSilenceId, setEditingSilenceId] = useState<string | null>(null);

  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [alertFilter, setAlertFilter] = useState('');
  const [alertSevFilter, setAlertSevFilter] = useState('all');
  const [alertStateFilter, setAlertStateFilter] = useState('all');

  const sevOptions = [...new Set(alerts.map(a => a.labels?.severity).filter(Boolean))].sort();
  const filteredAlerts = alerts.filter(a => {
    if (alertStateFilter !== 'all' && a.status?.state !== alertStateFilter) return false;
    if (alertSevFilter !== 'all' && a.labels?.severity !== alertSevFilter) return false;
    if (alertFilter) {
      const q = alertFilter.toLowerCase();
      const labelStr = Object.entries(a.labels || {}).map(([k,v]) => `${k}=${v}`).join(' ');
      return (a.labels?.alertname || '').toLowerCase().includes(q) || labelStr.includes(q);
    }
    return true;
  });

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const res = await amFetch(targetUrl, '/api/v2/alerts');
      const data = await res.json();
      if (res.ok) setAlerts(data || []);
      else setAlertsError(data.error || t('remote.failedFetch'));
    } catch { setAlertsError(t('remote.networkError')); }
    finally { setAlertsLoading(false); }
  };

  const fetchSilences = async () => {
    setSilencesLoading(true);
    setSilencesError('');
    try {
      const res = await amFetch(targetUrl, '/api/v2/silences');
      const data = await res.json();
      if (res.ok) setSilences(data || []);
      else setSilencesError(data.error || t('remote.failedFetch'));
    } catch { setSilencesError(t('remote.networkError')); }
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
      if (editingSilenceId) await amFetch(targetUrl, `/api/v2/silence/${editingSilenceId}`, { method: 'DELETE' });
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
        setEditingSilenceId(null);
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

  // Build label suggestions from current alerts
  const labelKeys = [...new Set(alerts.flatMap(a => Object.keys(a.labels || {})))].sort();
  const labelValues = (label: string) =>
    [...new Set(alerts.filter(a => a.labels?.[label]).map(a => a.labels[label]))].sort();

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      <div className="flex gap-1 mb-4 shrink-0">
        {(['alerts', 'silences', 'status'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setSubTab(tab); localStorage.setItem('am-subtab', tab); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'alerts' && <><Bell className="w-3.5 h-3.5 inline mr-1" />{t('remote.alerts')}</>}
            {tab === 'silences' && <><BellOff className="w-3.5 h-3.5 inline mr-1" />{t('remote.silences')}</>}
            {tab === 'status' && <><Activity className="w-3.5 h-3.5 inline mr-1" />{t('remote.status')}</>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {subTab === 'alerts' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 shrink-0">{filteredAlerts.length}/{alerts.length}</span>
              <input type="text" placeholder="Filter alerts..." value={alertFilter} onChange={e => setAlertFilter(e.target.value)}
                className="flex-1 min-w-[120px] text-xs p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-500" />
              <select value={alertSevFilter} onChange={e => setAlertSevFilter(e.target.value)} className="text-xs p-2 border border-gray-200 rounded-lg bg-white">
                <option value="all">All severities</option>{sevOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={alertStateFilter} onChange={e => setAlertStateFilter(e.target.value)} className="text-xs p-2 border border-gray-200 rounded-lg bg-white">
                <option value="all">All states</option><option value="active">Active</option><option value="suppressed">Suppressed</option>
              </select>
              <button onClick={fetchAlerts} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded shrink-0">
                <RefreshCw className={`w-3 h-3 ${alertsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {alertsError && <p className="text-xs text-red-500 mb-3">{alertsError}</p>}
            <div className="space-y-2">
              {filteredAlerts.map(alert => {
                const alertname = alert.labels?.alertname || alert.labels?.__name__ || 'Unknown';
                const severity = alert.labels?.severity || '';
                const state = alert.status?.state || 'unprocessed';
                const isExpanded = expandedAlerts.has(alert.fingerprint);
                const toggleExpand = () => {
                  const next = new Set(expandedAlerts);
                  isExpanded ? next.delete(alert.fingerprint) : next.add(alert.fingerprint);
                  setExpandedAlerts(next);
                };
                return (
                  <div key={alert.fingerprint} className={`bg-white border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer border-l-[3px] ${state === 'active' ? 'border-l-red-400' : state === 'suppressed' ? 'border-l-amber-400' : 'border-l-blue-400'}`} onClick={toggleExpand}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${stateBadge(state)}`}>
                            {state.toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 truncate">{alertname}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {severity && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">severity={severity}</span>}
                          {Object.entries(alert.labels || {}).filter(([k]) => !['alertname', 'severity', '__name__'].includes(k)).slice(0, 5).map(([k, v]) => (
                            <span key={k} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] font-mono">{k}={v}</span>
                          ))}
                          {(Object.keys(alert.labels || {}).length > 7) && <span className="text-[9px] text-gray-400 italic">+{(Object.keys(alert.labels || {}).length - 6)} more</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">{t('remote.since')}: {new Date(alert.startsAt).toLocaleString()}</p>
                      </div>
                      <span className="text-gray-300 text-xs mt-1 shrink-0">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">All Labels</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(alert.labels || {}).map(([k, v]) => (
                              <span key={k} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-mono">{k}={v}</span>
                            ))}
                          </div>
                        </div>
                        {alert.annotations && Object.keys(alert.annotations).length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Annotations</div>
                            <div className="space-y-1">
                              {Object.entries(alert.annotations).map(([k, v]) => (
                                <div key={k} className="text-[10px]"><span className="font-mono text-gray-600">{k}:</span> <span className="text-gray-500">{String(v).slice(0, 200)}</span></div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                          <div>Started: <span className="font-mono text-gray-700">{new Date(alert.startsAt).toLocaleString()}</span></div>
                          <div>Updated: <span className="font-mono text-gray-700">{new Date(alert.updatedAt).toLocaleString()}</span></div>
                          {alert.endsAt && <div>Ends: <span className="font-mono text-gray-700">{new Date(alert.endsAt).toLocaleString()}</span></div>}
                          {alert.generatorURL && <div className="col-span-2 truncate">Source: <a href={alert.generatorURL} target="_blank" rel="noopener" className="font-mono text-blue-600 hover:underline">{alert.generatorURL}</a></div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!alertsLoading && alerts.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <CheckIcon className="w-10 h-10 mx-auto mb-2 text-green-200" />
                  <span className="text-sm">{t('remote.noAlerts')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'silences' && (
          <SilencePanel {...{ targetUrl, silences, setSilences, silencesLoading, silencesError, setSilencesError,
            fetchSilences, newMatchers, setNewMatchers, newComment, setNewComment, newCreatedBy,
            setNewCreatedBy, newDuration, setNewDuration, createLoading, setCreateLoading,
            editingSilenceId, setEditingSilenceId, showSilenceForm, setShowSilenceForm,
            alerts, labelKeys, labelValues, t, amFetch, handleExpireSilence: handleExpireSilence }} />
        )}

        {subTab === 'status' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{t('remote.clusterStatus')}</span>
              <button onClick={fetchStatus} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">
                <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} /> {t('remote.refresh')}
              </button>
            </div>
            {status ? (
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-500" /> {t('remote.version')}
                  </h4>
                  <p className="text-xs font-mono text-gray-800">{status?.versionInfo?.version || 'Unknown'}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> {t('remote.uptime')}
                  </h4>
                  <p className="text-xs font-mono text-gray-800">{status?.cluster?.status || 'ready'}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Server className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <span className="text-sm">{statusLoading ? t('remote.loading') : t('remote.noStatus')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Silence management panel with features matching the Alertmanager original UI
function SilencePanel({ targetUrl, silences, setSilences, silencesLoading, silencesError, setSilencesError, fetchSilences, newMatchers, setNewMatchers, newComment, setNewComment, newCreatedBy, setNewCreatedBy, newDuration, setNewDuration, createLoading, setCreateLoading, editingSilenceId, setEditingSilenceId, showSilenceForm, setShowSilenceForm, alerts, labelKeys, labelValues, t, amFetch, handleExpireSilence: expireSilence }: any) {
  const [silenceState, setSilenceState] = useState<'active' | 'pending' | 'expired'>(() => {
    return (localStorage.getItem('am-silence-state') as any) || 'active';
  });
  const [filterText, setFilterText] = useState('');
  const [newStartAt, setNewStartAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');

  const activeCount = silences.filter((s: any) => s.status.state === 'active').length;
  const pendingCount = silences.filter((s: any) => s.status.state === 'pending').length;
  const expiredCount = silences.filter((s: any) => s.status.state === 'expired').length;

  const matchingAlerts = alerts.filter((a: any) => {
    const valid = newMatchers.filter((m: any) => m.name);
    if (valid.length === 0) return false;
    return valid.every((m: any) => {
      const lv = a.labels?.[m.name];
      if (!lv) return false;
      if (!m.value) return true; // match on label alone
      return m.isRegex ? new RegExp(m.value).test(lv) : lv === m.value;
    });
  });

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      if (editingSilenceId) await amFetch(targetUrl, `/api/v2/silence/${editingSilenceId}`, { method: 'DELETE' });
      const now = new Date();
      const start = newStartAt ? new Date(newStartAt) : now;
      let end: Date;
      if (newEndAt) { end = new Date(newEndAt); }
      else { end = new Date(start.getTime()); end.setHours(end.getHours() + (parseFloat(newDuration) || 2)); }
      const res = await amFetch(targetUrl, '/api/v2/silences', {
        method: 'POST', body: JSON.stringify({
          matchers: newMatchers.filter((m: any) => m.name && m.value),
          startsAt: start.toISOString(), endsAt: end.toISOString(),
          createdBy: newCreatedBy || 'admin', comment: newComment || 'Silence via Configurer',
        }),
      });
      if (res.ok) {
        setShowSilenceForm(false); setEditingSilenceId(null);
        setNewMatchers([{ name: '', value: '', isRegex: false }]);
        setNewComment(''); setNewStartAt(''); setNewEndAt('');
        fetchSilences();
      }
    } catch {} finally { setCreateLoading(false); }
  };

  const reset = () => { setNewMatchers([{ name: '', value: '', isRegex: false }]); setNewComment(''); setNewCreatedBy(''); setNewDuration('2h'); setNewStartAt(''); setNewEndAt(''); setEditingSilenceId(null); };

  const filtered = silences.filter((s: any) => {
    if (s.status.state !== silenceState) return false;
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return (s.createdBy||'').toLowerCase().includes(t) || (s.comment||'').toLowerCase().includes(t) || s.matchers?.some((m: any) => `${m.name}=${m.value}`.toLowerCase().includes(t));
  });

  const dt = (d: Date) => d.toISOString().slice(0, 16);
  const endFromStart = (s: string) => { const d = s ? new Date(s) : new Date(); d.setHours(d.getHours() + (parseFloat(newDuration) || 2)); return dt(d); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {(['active','pending','expired'] as const).map(st => (
            <button key={st} onClick={() => { setSilenceState(st); localStorage.setItem('am-silence-state', st); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${silenceState===st ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {st==='active'?t('silences.status_active'):st==='pending'?t('silences.status_pending'):t('silences.status_expired')} {st==='active'?activeCount:st==='pending'?pendingCount:expiredCount}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSilences} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"><RefreshCw className="w-3 h-3"/> {t('remote.refresh')}</button>
          <button onClick={()=>{setShowSilenceForm(true);reset();}} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"><Plus className="w-3 h-3"/> {t('remote.newSilence')}</button>
        </div>
      </div>
      <div className="mb-3"><input type="text" placeholder="Filter silences..." value={filterText} onChange={e=>setFilterText(e.target.value)} className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-500"/></div>
      {silencesError && <p className="text-xs text-red-500 mb-3">{silencesError}</p>}
      {showSilenceForm && (
        <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
          <div className="text-xs font-bold text-gray-700 mb-3">{editingSilenceId ? 'Edit Silence' : 'New Silence'}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
            <div><label className="text-[10px] text-gray-500">Start</label><input type="datetime-local" value={newStartAt || dt(new Date())} onChange={e=>setNewStartAt(e.target.value)} className="w-full text-xs p-1.5 border rounded bg-white"/></div>
            <div><label className="text-[10px] text-gray-500">Duration</label><select value={newDuration} onChange={e=>setNewDuration(e.target.value)} className="w-full text-xs p-1.5 border rounded bg-white"><option value="1">1h</option><option value="2">2h</option><option value="4">4h</option><option value="8">8h</option><option value="24">24h</option><option value="48">48h</option></select></div>
            <div><label className="text-[10px] text-gray-500">End</label><input type="datetime-local" value={newEndAt || endFromStart(newStartAt)} onChange={e=>setNewEndAt(e.target.value)} className="w-full text-xs p-1.5 border rounded bg-white"/></div>
            <div><label className="text-[10px] text-gray-500">Creator</label><input type="text" placeholder={t('remote.createdBy')} value={newCreatedBy} onChange={e=>setNewCreatedBy(e.target.value)} className="w-full text-xs p-1.5 border rounded"/></div>
          </div>
          <input type="text" placeholder={t('remote.comment')} value={newComment} onChange={e=>setNewComment(e.target.value)} className="w-full text-xs p-2 border rounded mb-3"/>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Matchers</span>
            {matchingAlerts.length > 0 && <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{matchingAlerts.length} alert(s) affected</span>}
          </div>
          <div className="space-y-1.5 mb-3">
            {newMatchers.map((m:any,i:number)=>(
              <div key={i} className="flex gap-2 items-center">
                <select value={m.name} onChange={e=>{const u=[...newMatchers];u[i]={...u[i],name:e.target.value,value:''};setNewMatchers(u);}} className="flex-1 text-xs p-1.5 border rounded bg-white font-mono">
                  <option value="">label...</option>{labelKeys.map((k:string)=><option key={k} value={k}>{k}</option>)}
                </select>
                <select value={m.isRegex?'=~':'='} onChange={e=>{const u=[...newMatchers];u[i]={...u[i],isRegex:e.target.value==='=~'};setNewMatchers(u);}} className="text-xs p-1.5 border rounded bg-white shrink-0"><option value="=">=</option><option value="=~">=~</option></select>
                {m.name?(
                  <input type="text" value={m.value} onChange={e=>{const u=[...newMatchers];u[i]={...u[i],value:e.target.value};setNewMatchers(u);}} placeholder="value" className="flex-1 text-xs p-1.5 border rounded font-mono"/>
                ):(
                  <input type="text" placeholder="value" value={m.value} onChange={e=>{const u=[...newMatchers];u[i]={...u[i],value:e.target.value};setNewMatchers(u);}} className="flex-1 text-xs p-1.5 border rounded font-mono"/>
                )}
                {newMatchers.length>1&&<button onClick={()=>setNewMatchers(newMatchers.filter((_:any,j:number)=>j!==i))} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>}
              </div>
            ))}
            <button onClick={()=>setNewMatchers([...newMatchers,{name:'',value:'',isRegex:false}])} className="text-xs text-blue-600 font-semibold">{t('remote.addMatcher')}</button>
          </div>
          {matchingAlerts.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Preview Alerts ({matchingAlerts.length})</div>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {matchingAlerts.slice(0, 8).map((a: any) => {
                  const state = a.status?.state || 'unprocessed';
                  const sev = a.labels?.severity || '';
                  const sevColors: any = { critical: 'bg-red-50 text-red-700 border-red-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', notice: 'bg-blue-50 text-blue-700 border-blue-200', info: 'bg-gray-50 text-gray-600 border-gray-200' };
                  return (
                    <div key={a.fingerprint} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2.5 py-1.5">
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${state === 'active' ? 'bg-red-400' : state === 'suppressed' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                      <span className="text-[11px] font-semibold text-gray-700 truncate flex-1">{a.labels?.alertname || 'Unknown'}</span>
                      {sev && <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-medium ${sevColors[sev] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{sev}</span>}
                    </div>
                  );
                })}
                {matchingAlerts.length > 8 && (
                  <div className="text-[10px] text-gray-400 italic text-center py-1">...and {matchingAlerts.length - 8} more alerts</div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={()=>{setShowSilenceForm(false);reset();}} className="px-3 py-1.5 text-xs border rounded">{t('common.cancel')}</button>
            <button onClick={reset} className="px-3 py-1.5 text-xs border rounded">Reset</button>
            <button onClick={handleCreate} disabled={createLoading} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50">{createLoading?t('remote.creating'):t('remote.createSilence')}</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((s:any)=>(
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${s.status.state==='active'?'bg-blue-50 text-blue-700 border-blue-200':s.status.state==='expired'?'bg-gray-50 text-gray-500 border-gray-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{s.status.state.toUpperCase()}</span>
                  <span className="text-xs font-semibold text-gray-700 truncate">{s.createdBy||'Unknown'}: {s.comment}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">{s.matchers.map((m:any,i:number)=>(<span key={i} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-mono">{m.name}{m.isRegex?'=~':'='}{m.value}</span>))}</div>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(s.startsAt).toLocaleString()} - {new Date(s.endsAt).toLocaleString()}</p>
              </div>
              {s.status.state!=='expired'&&(
                <><button onClick={()=>{setEditingSilenceId(s.id);setShowSilenceForm(true);setNewCreatedBy(s.createdBy||'');setNewComment(s.comment||'');setNewMatchers(s.matchers.length>0?s.matchers.map((m:any)=>({name:m.name,value:m.value,isRegex:m.isRegex})):[{name:'',value:'',isRegex:false}]);setNewStartAt(dt(new Date(s.startsAt)));setNewEndAt(dt(new Date(s.endsAt)));}} className="text-xs text-blue-500 hover:text-blue-600 font-semibold whitespace-nowrap ml-2">{t('common.edit')}</button>
                <button onClick={()=>expireSilence(s.id)} className="text-xs text-red-500 hover:text-red-600 font-semibold whitespace-nowrap ml-2">{t('remote.expire')}</button></>
              )}
            </div>
          </div>
        ))}
        {filtered.length===0&&!silencesLoading&&<div className="text-center py-16 text-gray-400"><Clock className="w-10 h-10 mx-auto mb-2 text-gray-200"/><span className="text-sm">{t('remote.noSilences')}</span></div>}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
