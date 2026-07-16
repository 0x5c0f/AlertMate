
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Silence, Matcher } from '../types';
import { Plus, Trash2, Calendar, User, MessageSquare, AlertTriangle, Eye, EyeOff, Search, Clock, CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface SilenceManagerProps {
  silences: Silence[];
  onChange: (silences: Silence[]) => void;
}

export default function SilenceManager({ silences, onChange }: SilenceManagerProps) {
  const { t } = useTranslation();
  const [confirmExpireId, setConfirmExpireId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New silence form state
  const [creator, setCreator] = useState('');
  const [comment, setComment] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [newMatchers, setNewMatchers] = useState<Matcher[]>([
    { label: 'instance', value: '', isRegex: false }
  ]);

  const handleAddMatcherRow = () => {
    setNewMatchers([...newMatchers, { label: '', value: '', isRegex: false }]);
  };

  const handleRemoveMatcherRow = (idx: number) => {
    if (newMatchers.length <= 1) return;
    setNewMatchers(newMatchers.filter((_, i) => i !== idx));
  };

  const handleUpdateMatcherRow = (idx: number, updated: Partial<Matcher>) => {
    setNewMatchers(newMatchers.map((m, i) => i === idx ? { ...m, ...updated } : m));
  };

  const handleCreateSilence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator.trim() || !comment.trim()) {
      setAlertMessage(t('silences.validation_fillRequired'));
      return;
    }

    // Check if any matchers are empty
    const invalidMatcher = newMatchers.some(m => !m.label.trim() || !m.value.trim());
    if (invalidMatcher) {
      setAlertMessage(t('silences.validation_matchersNonEmpty'));
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + parseFloat(durationHours) * 60 * 60 * 1000);

    const newSilence: Silence = {
      id: `silence-${Date.now()}`,
      matchers: newMatchers.map(m => ({
        label: m.label.trim(),
        value: m.value.trim(),
        isRegex: m.isRegex
      })),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      createdBy: creator.trim(),
      comment: comment.trim(),
      status: 'active'
    };

    onChange([newSilence, ...silences]);
    setIsAdding(false);
    
    // Reset form
    setCreator('');
    setComment('');
    setDurationHours('2');
    setNewMatchers([{ label: 'instance', value: '', isRegex: false }]);
  };

  const handleExpireSilence = (id: string) => {
    setConfirmExpireId(id);
  };

  const handleConfirmExpire = () => {
    if (!confirmExpireId) return;
    const updated = silences.map(sil => {
      if (sil.id === confirmExpireId) {
        return {
          ...sil,
          endsAt: new Date().toISOString(),
          status: 'expired' as const
        };
      }
      return sil;
    });
    onChange(updated);
    setConfirmExpireId(null);
  };

  const getStatus = (sil: Silence): 'active' | 'pending' | 'expired' => {
    const now = new Date();
    const start = new Date(sil.startsAt);
    const end = new Date(sil.endsAt);

    if (now < start) return 'pending';
    if (now > end) return 'expired';
    return 'active';
  };

  const filteredSilences = silences.filter(sil => {
    const status = getStatus(sil);
    const textSearch = `${sil.createdBy} ${sil.comment} ${sil.matchers.map(m => `${m.label}=${m.value}`).join(' ')}`.toLowerCase();
    
    const matchesSearch = textSearch.includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Upper bar with Search & Create toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('silences.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
            isAdding
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isAdding ? t('common.cancel') : <><Plus className="w-3.5 h-3.5" /> {t('silences.scheduleNew')}</>}
        </button>
      </div>

      {/* Creation form */}
      {isAdding && (
        <form onSubmit={handleCreateSilence} className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-500" />
            {t('silences.scheduleNew')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{t('silences.createdBy')}</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex (Ops Team)"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  className="w-full text-xs pl-8.5 pr-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{t('silences.duration')}</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white h-9"
              >
                <option value="0.5">{t('silences.duration_30m')}</option>
                <option value="1">{t('silences.duration_1h')}</option>
                <option value="2">{t('silences.duration_2h')}</option>
                <option value="4">{t('silences.duration_4h')}</option>
                <option value="8">{t('silences.duration_8h')}</option>
                <option value="24">{t('silences.duration_24h')}</option>
                <option value="168">{t('silences.duration_7d')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{t('silences.comment')}</label>
              <div className="relative">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Upgrade PostgreSQL engine to 15.3"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full text-xs pl-8.5 pr-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Matchers Subform */}
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{t('silences.targetMatchers')}</span>
              <button
                type="button"
                onClick={handleAddMatcherRow}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold"
              >
                {t('silences.addMatcher')}
              </button>
            </div>

            <div className="space-y-2">
              {newMatchers.map((m, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Label name (e.g., instance, job)"
                    value={m.label}
                    onChange={(e) => handleUpdateMatcherRow(idx, { label: e.target.value })}
                    className="w-full sm:w-1/3 text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  />
                  <select
                    value={m.isRegex ? '=~' : '='}
                    onChange={(e) => handleUpdateMatcherRow(idx, { isRegex: e.target.value === '=~' })}
                    className="w-full sm:w-24 text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white font-mono"
                  >
                    <option value="=">=</option>
                    <option value="=~">=~ (Regex)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value (e.g. db-prod-01, web-.*)"
                    value={m.value}
                    onChange={(e) => handleUpdateMatcherRow(idx, { value: e.target.value })}
                    className="w-full sm:flex-1 text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMatcherRow(idx)}
                    disabled={newMatchers.length <= 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded hover:bg-gray-100 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              {t('silences.addSilence')}
            </button>
          </div>
        </form>
      )}

      {/* Silences List */}
      <div className="space-y-3">
        {filteredSilences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400 bg-white">
            <Clock className="w-10 h-10 mb-2 text-gray-300" />
            <span className="text-sm font-semibold">{t('silences.noSilences')}</span>
            <span className="text-xs text-gray-400 mt-1">{t('silences.noSilencesHint')}</span>
          </div>
        ) : (
          filteredSilences.map((sil) => {
            const status = getStatus(sil);
            
            return (
              <div
                key={sil.id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${
                  status === 'active'
                    ? 'border-l-4 border-l-blue-500 border-gray-200'
                    : status === 'pending'
                    ? 'border-l-4 border-l-amber-500 border-gray-200'
                    : 'border-l-4 border-l-gray-300 border-gray-150 bg-gray-50/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left Info Column */}
                  <div className="space-y-3 flex-1">
                    {/* Status badge + Creators */}
                    <div className="flex flex-wrap items-center gap-2">
                      {status === 'active' && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <PlayCircle className="w-3 h-3" />
                          {t('silences.status_active')}
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Clock className="w-3 h-3" />
                          {t('silences.status_pending')}
                        </span>
                      )}
                      {status === 'expired' && (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <XCircle className="w-3 h-3" />
                          {t('silences.status_expired')}
                        </span>
                      )}

                      <span className="text-xs text-gray-400">{t('silences.id')} <span className="font-mono text-gray-500 select-all">{sil.id}</span></span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        {sil.createdBy}
                      </span>
                    </div>

                    {/* Comment explanation */}
                    <div className="text-xs text-gray-700 font-medium">
                      "{sil.comment}"
                    </div>

                    {/* Visual Matchers */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sil.matchers.map((m, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center bg-gray-50 text-gray-700 border border-gray-200 rounded px-2 py-0.5 text-[10px] font-mono"
                        >
                          <span className="text-gray-400 mr-0.5">{m.label}</span>
                          <span className="text-blue-500 font-bold mx-0.5">{m.isRegex ? '=~' : '='}</span>
                          <span className="text-gray-800 font-medium">"{m.value}"</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Timing + Action Column */}
                  <div className="flex flex-col sm:items-end justify-between self-stretch shrink-0 gap-3 min-w-[200px]">
                    <div className="text-right space-y-1 text-[11px] text-gray-500">
                      <div className="flex items-center sm:justify-end gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{t('silences.start')} {new Date(sil.startsAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center sm:justify-end gap-1.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>{t('silences.end')} {new Date(sil.endsAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {status !== 'expired' && (
                      <button
                        onClick={() => handleExpireSilence(sil.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors bg-white shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('silences.expireSilence')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <ConfirmDialog
        open={!!alertMessage}
        title={t('common.warning')}
        message={alertMessage || ''}
        confirmLabel={t('common.ok')}
        showCancel={false}
        variant="warning"
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
      />

      <ConfirmDialog
        open={!!confirmExpireId}
        title={t('silences.expireSilence')}
        message={t('silences.expireConfirm')}
        confirmLabel={t('silences.expireSilence')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={handleConfirmExpire}
        onCancel={() => setConfirmExpireId(null)}
      />
    </div>
  );
}
