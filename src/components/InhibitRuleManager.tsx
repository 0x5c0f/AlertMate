
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InhibitRule } from '../types';
import { Plus, Trash2, ShieldAlert, ArrowRight, HelpCircle, Layers, CheckCircle, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface InhibitRuleManagerProps {
  inhibitRules: InhibitRule[];
  onChange: (rules: InhibitRule[]) => void;
}

export default function InhibitRuleManager({ inhibitRules, onChange }: InhibitRuleManagerProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAddRule = () => {
    const newRule: InhibitRule = {
      id: `inhibit-${Date.now()}`,
      source_matchers: ['alertname="NodeDown"'],
      target_matchers: ['severity="critical"'],
      equal: ['node', 'instance']
    };
    onChange([...inhibitRules, newRule]);
    setEditingId(newRule.id);
  };

  const handleDeleteRule = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    onChange(inhibitRules.filter(r => r.id !== confirmDeleteId));
    if (editingId === confirmDeleteId) setEditingId(null);
    setConfirmDeleteId(null);
  };

  const handleUpdateRule = (id: string, updatedFields: Partial<InhibitRule>) => {
    onChange(inhibitRules.map(r => r.id === id ? { ...r, ...updatedFields } : r));
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-blue-500/5 to-amber-500/5 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{t('inhibit.title')}</h3>
            <p className="text-xs text-gray-500 max-w-xl mt-1">
              {t('inhibit.description')}
            </p>
          </div>
        </div>
        <button
          onClick={handleAddRule}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('inhibit.addRule')}
        </button>
      </div>

      {/* Rules Grid */}
      {inhibitRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400 bg-white">
          <Layers className="w-10 h-10 mb-2 text-gray-300" />
          <span className="text-sm font-semibold">{t('inhibit.noRules')}</span>
          <span className="text-xs text-gray-400 mt-1">{t('inhibit.noRulesHint')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {inhibitRules.map((rule, idx) => {
            const isEditing = editingId === rule.id;

            return (
              <div
                key={rule.id}
                className={`bg-white border rounded-xl shadow-sm transition-all ${
                  isEditing ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                }`}
              >
                {/* Rule Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-t-xl border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 font-mono">{t('inhibit.ruleNumber', { n: idx + 1 })}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-medium text-gray-600">
                      {t('inhibit.suppress')}{' '}
                      <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono font-medium border border-red-100">
                        {t('inhibit.targetMatchers')}
                      </span>{' '}
                      when{' '}
                      <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-mono font-medium border border-green-100">
                        {t('inhibit.sourceAlert')}
                      </span>{' '}
                      {t('inhibit.fires')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingId(isEditing ? null : rule.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                        isEditing
                          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {isEditing ? t('inhibit.doneEditing') : t('inhibit.editRule')}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title={t('inhibit.deleteRule')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Rule Body */}
                <div className="p-5">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Source Matchers */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                            {t('inhibit.sourceMatchers', { color: '绿色' })}
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title={t('inhibit.tooltips.source')} />
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(rule.source_matchers || []).map((m, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[10px] font-mono text-green-800">
                              {m}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(rule.source_matchers || [])];
                                  updated.splice(idx, 1);
                                  handleUpdateRule(rule.id, { source_matchers: updated });
                                }}
                                className="p-0.5 rounded hover:bg-green-200/50 text-green-400 hover:text-green-600"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            id={`source-${rule.id}`}
                            placeholder='alertname="NodeDown"'
                            className="flex-1 text-[10px] p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && !(rule.source_matchers || []).includes(val)) {
                                  handleUpdateRule(rule.id, { source_matchers: [...(rule.source_matchers || []), val] });
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`source-${rule.id}`) as HTMLInputElement;
                              const val = input?.value?.trim();
                              if (val && !(rule.source_matchers || []).includes(val)) {
                                handleUpdateRule(rule.id, { source_matchers: [...(rule.source_matchers || []), val] });
                                input.value = '';
                              }
                            }}
                            className="px-2 py-1.5 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[9px] text-gray-400 mt-1 block">{t('inhibit.commaHint')}</span>
                      </div>

                      {/* Target Matchers */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                            {t('inhibit.targetMatchersColored', { color: '红色' })}
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title={t('inhibit.tooltips.target')} />
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(rule.target_matchers || []).map((m, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-[10px] font-mono text-red-800">
                              {m}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(rule.target_matchers || [])];
                                  updated.splice(idx, 1);
                                  handleUpdateRule(rule.id, { target_matchers: updated });
                                }}
                                className="p-0.5 rounded hover:bg-red-200/50 text-red-400 hover:text-red-600"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            id={`target-${rule.id}`}
                            placeholder='severity="critical"'
                            className="flex-1 text-[10px] p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && !(rule.target_matchers || []).includes(val)) {
                                  handleUpdateRule(rule.id, { target_matchers: [...(rule.target_matchers || []), val] });
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`target-${rule.id}`) as HTMLInputElement;
                              const val = input?.value?.trim();
                              if (val && !(rule.target_matchers || []).includes(val)) {
                                handleUpdateRule(rule.id, { target_matchers: [...(rule.target_matchers || []), val] });
                                input.value = '';
                              }
                            }}
                            className="px-2 py-1.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[9px] text-gray-400 mt-1 block">{t('inhibit.secondaryHint')}</span>
                      </div>

                      {/* Equal Labels */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                            {t('inhibit.matchingLabels')}
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title={t('inhibit.tooltips.equal')} />
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(rule.equal || []).map((eq, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-mono text-blue-800">
                              {eq}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(rule.equal || [])];
                                  updated.splice(idx, 1);
                                  handleUpdateRule(rule.id, { equal: updated });
                                }}
                                className="p-0.5 rounded hover:bg-blue-200/50 text-blue-400 hover:text-blue-600"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            id={`equal-${rule.id}`}
                            placeholder="instance"
                            className="flex-1 text-[10px] p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && !(rule.equal || []).includes(val)) {
                                  handleUpdateRule(rule.id, { equal: [...(rule.equal || []), val] });
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`equal-${rule.id}`) as HTMLInputElement;
                              const val = input?.value?.trim();
                              if (val && !(rule.equal || []).includes(val)) {
                                handleUpdateRule(rule.id, { equal: [...(rule.equal || []), val] });
                                input.value = '';
                              }
                            }}
                            className="px-2 py-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[9px] text-gray-400 mt-1 block">{t('inhibit.labelCheck')}</span>
                      </div>
                    </div>
                  ) : (
                    // Display Mode (Clean flow representation)
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
                      {/* Source */}
                      <div className="flex-1 flex flex-col bg-white border border-green-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-green-600 uppercase mb-1.5">{t('inhibit.primaryFiring')}</span>
                        <div className="flex flex-wrap gap-1">
                          {rule.source_matchers && rule.source_matchers.length > 0 ? (
                            rule.source_matchers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-green-50 text-green-800 border border-green-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">{t('inhibit.noSourceCriteria')}</span>
                          )}
                        </div>
                      </div>

                      {/* Flow arrow */}
                      <div className="flex flex-col items-center justify-center text-gray-400 shrink-0">
                        <span className="text-[9px] font-bold uppercase mb-1 text-gray-400">{t('inhibit.blocksNotification')}</span>
                        <div className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      {/* Target */}
                      <div className="flex-1 flex flex-col bg-white border border-red-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-red-600 uppercase mb-1.5">{t('inhibit.targetInhibited')}</span>
                        <div className="flex flex-wrap gap-1">
                          {rule.target_matchers && rule.target_matchers.length > 0 ? (
                            rule.target_matchers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-red-50 text-red-800 border border-red-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">{t('inhibit.noTargetCriteria')}</span>
                          )}
                        </div>
                      </div>

                      {/* Equal constraints */}
                      <div className="md:w-48 flex flex-col justify-center bg-blue-50/30 border border-blue-100/50 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-blue-600 uppercase mb-1">{t('inhibit.ifLabelEqual')}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rule.equal && rule.equal.length > 0 ? (
                            rule.equal.map((eq, eqIdx) => (
                              <span key={eqIdx} className="bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {eq}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">{t('inhibit.unconditionalBlock')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title={t('inhibit.deleteConfirm')}
        message={t('inhibit.deleteConfirm')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
