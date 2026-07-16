
import React, { useState } from 'react';
import { InhibitRule } from '../types';
import { Plus, Trash2, ShieldAlert, ArrowRight, HelpCircle, Layers, CheckCircle } from 'lucide-react';

interface InhibitRuleManagerProps {
  inhibitRules: InhibitRule[];
  onChange: (rules: InhibitRule[]) => void;
}

export default function InhibitRuleManager({ inhibitRules, onChange }: InhibitRuleManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
    if (confirm("Are you sure you want to delete this inhibit rule?")) {
      onChange(inhibitRules.filter(r => r.id !== id));
      if (editingId === id) setEditingId(null);
    }
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
            <h3 className="text-sm font-bold text-gray-800">Inhibition Rules (Inhibit Rules)</h3>
            <p className="text-xs text-gray-500 max-w-xl mt-1">
              Inhibition rules prevent secondary alerts from triggering notifications if a primary alert is already firing. For example, if a machine is down (NodeDown), suppress all CPU/Memory alarms for that instance.
            </p>
          </div>
        </div>
        <button
          onClick={handleAddRule}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Inhibit Rule
        </button>
      </div>

      {/* Rules Grid */}
      {inhibitRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400 bg-white">
          <Layers className="w-10 h-10 mb-2 text-gray-300" />
          <span className="text-sm font-semibold">No inhibition rules configured</span>
          <span className="text-xs text-gray-400 mt-1">Click "Add Inhibit Rule" above to suppress alert flooding.</span>
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
                    <span className="text-xs font-bold text-gray-500 font-mono">RULE #{idx + 1}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-medium text-gray-600">
                      Suppress alerts matching{' '}
                      <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono font-medium border border-red-100">
                        Target Matchers
                      </span>{' '}
                      when{' '}
                      <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-mono font-medium border border-green-100">
                        Source Alert
                      </span>{' '}
                      fires
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
                      {isEditing ? 'Done Editing' : 'Edit Rule'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title="Delete Rule"
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
                            Source Alert Matchers (绿色)
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title="The primary alerting incident that triggers suppression (e.g. NodeDown)." />
                        </div>
                        <input
                          type="text"
                          value={rule.source_matchers?.join(', ') || ''}
                          onChange={(e) => {
                            const list = e.target.value.split(',').map(m => m.trim()).filter(m => m.length > 0);
                            handleUpdateRule(rule.id, { source_matchers: list });
                          }}
                          placeholder='alertname="NodeDown"'
                          className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">Comma-separated label list</span>
                      </div>

                      {/* Target Matchers */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                            Target Alert Matchers (红色)
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title="The alerts to suppress/silence (e.g. DiskUsageHigh, CPUUsageHigh)." />
                        </div>
                        <input
                          type="text"
                          value={rule.target_matchers?.join(', ') || ''}
                          onChange={(e) => {
                            const list = e.target.value.split(',').map(m => m.trim()).filter(m => m.length > 0);
                            handleUpdateRule(rule.id, { target_matchers: list });
                          }}
                          placeholder='severity="critical"'
                          className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">Secondary alerts to block</span>
                      </div>

                      {/* Equal Labels */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                            Matching Labels (Equal)
                          </label>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400" title="Labels that must have equal values in both source and target alerts to trigger inhibition." />
                        </div>
                        <input
                          type="text"
                          value={rule.equal?.join(', ') || ''}
                          onChange={(e) => {
                            const list = e.target.value.split(',').map(m => m.trim()).filter(m => m.length > 0);
                            handleUpdateRule(rule.id, { equal: list });
                          }}
                          placeholder="instance, node, env"
                          className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">Checks equal values across tags</span>
                      </div>
                    </div>
                  ) : (
                    // Display Mode (Clean flow representation)
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
                      {/* Source */}
                      <div className="flex-1 flex flex-col bg-white border border-green-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-green-600 uppercase mb-1.5">Primary Firing Alert</span>
                        <div className="flex flex-wrap gap-1">
                          {rule.source_matchers && rule.source_matchers.length > 0 ? (
                            rule.source_matchers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-green-50 text-green-800 border border-green-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No source criteria</span>
                          )}
                        </div>
                      </div>

                      {/* Flow arrow */}
                      <div className="flex flex-col items-center justify-center text-gray-400 shrink-0">
                        <span className="text-[9px] font-bold uppercase mb-1 text-gray-400">Blocks Notification</span>
                        <div className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      {/* Target */}
                      <div className="flex-1 flex flex-col bg-white border border-red-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-red-600 uppercase mb-1.5">Target Alerts (Inhibited)</span>
                        <div className="flex flex-wrap gap-1">
                          {rule.target_matchers && rule.target_matchers.length > 0 ? (
                            rule.target_matchers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-red-50 text-red-800 border border-red-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No target criteria</span>
                          )}
                        </div>
                      </div>

                      {/* Equal constraints */}
                      <div className="md:w-48 flex flex-col justify-center bg-blue-50/30 border border-blue-100/50 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-blue-600 uppercase mb-1">If Label Values Equal</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rule.equal && rule.equal.length > 0 ? (
                            rule.equal.map((eq, eqIdx) => (
                              <span key={eqIdx} className="bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {eq}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unconditional block</span>
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
    </div>
  );
}
