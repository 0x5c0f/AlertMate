
import React, { useState } from 'react';
import { AlertmanagerConfig, Receiver, Route, InhibitRule } from '../types';
import { Sparkles, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, MessageSquare, List, Play, Compass } from 'lucide-react';

interface AiCopilotProps {
  currentConfig: AlertmanagerConfig;
  onApplySuggestions: (suggestions: {
    receivers?: Receiver[];
    route?: Route;
    inhibit_rules?: InhibitRule[];
  }) => void;
}

export default function AiCopilot({ currentConfig, onApplySuggestions }: AiCopilotProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('alertmanager-copilot-model') || 'gemini-3.5-flash';
  });
  const [customModelInput, setCustomModelInput] = useState<string>(() => {
    return localStorage.getItem('alertmanager-copilot-custom-model') || '';
  });

  // Suggested Result from API
  const [suggestion, setSuggestion] = useState<{
    explanation: string;
    suggestedConfig: {
      receivers?: Receiver[];
      route?: Route;
      inhibit_rules?: InhibitRule[];
    };
  } | null>(null);

  const [applied, setApplied] = useState(false);

  const samplePrompts = [
    {
      title: "Dev vs Prod Separation",
      text: "Separated routes: warnings go to dingtalk-dev-warnings; production criticals go to wechat-ops-critical with continue enabled, then filter db-dba-sms for database services."
    },
    {
      title: "PagerDuty Escalation Hierarchy",
      text: "Configure Slack alerts for standard notifications, and add a PagerDuty escalation trigger on critical alerts. Match serverity=\"critical\"."
    },
    {
      title: "Advanced Inhibit Rules Layout",
      text: "Add an inhibit rule to suppress all CPU and Disk alerts on nodes where NodeDown or ClusterManagerDown is active, matched by the instance tag."
    },
    {
      title: "Clean standard multi-channel receivers",
      text: "Create receivers for Security-Team, Ops-Core, and Database-Oncall. Configure appropriate webhook and email destination structures."
    }
  ];

  const handleAskAi = async (textToSend = prompt) => {
    if (!textToSend.trim()) return;
    setIsLoading(true);
    setError(null);
    setSuggestion(null);
    setApplied(false);

    const modelToUse = selectedModel === 'custom' ? customModelInput.trim() : selectedModel;

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          currentConfig,
          model: modelToUse || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status} error from server`);
      }

      const data = await res.json();
      setSuggestion({
        explanation: data.explanation || 'Suggested configuration updated successfully.',
        suggestedConfig: data.suggestedConfig || {}
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect to AI server. Verify your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion || !suggestion.suggestedConfig) return;
    onApplySuggestions(suggestion.suggestedConfig);
    setApplied(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Ask AI Control Box */}
      <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-[calc(100vh-180px)] min-h-[480px]">
        <div className="space-y-4">
          <div className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Operations Copilot Advisor
          </div>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            Prompt Gemini with architectural rules or notification demands to construct or repair Alertmanager trees and receivers automatically.
          </p>

          {/* Model Configuration Selector */}
          <div className="p-3.5 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2.5">
            <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
              🤖 Copilot Model Selection
            </label>
            <div className="flex gap-2">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem('alertmanager-copilot-model', e.target.value);
                }}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white"
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="custom">Custom Model ID...</option>
              </select>
            </div>
            {selectedModel === 'custom' && (
              <input
                type="text"
                value={customModelInput}
                onChange={(e) => {
                  setCustomModelInput(e.target.value);
                  localStorage.setItem('alertmanager-copilot-custom-model', e.target.value);
                }}
                placeholder="e.g., gemini-2.0-flash"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white placeholder-gray-400 font-mono"
              />
            )}
          </div>

          {/* Quick suggestions templates */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Quick Template Scenarios
            </span>
            <div className="grid grid-cols-1 gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p.text);
                    handleAskAi(p.text);
                  }}
                  className="text-left text-[11px] p-2.5 border border-gray-100 hover:border-purple-200 rounded-lg hover:bg-purple-50/10 transition-all text-gray-600 font-medium cursor-pointer"
                >
                  <span className="text-purple-600 font-bold block mb-0.5">★ {p.title}</span>
                  <span className="text-gray-400 line-clamp-2">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Area prompt input */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Set up dev/prod separation with Slack on warnings and WeChat on critical production alerts..."
            className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none resize-none bg-white"
          />
          <button
            onClick={() => handleAskAi()}
            disabled={isLoading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Analyzing with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Visual Config Proposal
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggested Results Preview Panel */}
      <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-[calc(100vh-180px)] min-h-[480px] overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
            <div className="text-center space-y-1">
              <span className="text-xs font-semibold text-gray-700 block">SRE Advisor is Thinking...</span>
              <span className="text-[10px] text-gray-400 block max-w-xs">Generating route trees, matching filters, and compiling integration configurations. Please wait.</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <div className="space-y-1">
              <span className="text-sm font-bold text-gray-800 block">Failed to Generate Proposal</span>
              <p className="text-xs text-gray-500 max-w-sm">{error}</p>
            </div>
            <button
              onClick={() => handleAskAi()}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs text-gray-600 font-semibold rounded-lg transition-all"
            >
              Retry
            </button>
          </div>
        ) : suggestion ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header / Explanation */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 shrink-0">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Suggested Architecture Ready
              </span>
              <button
                onClick={handleApply}
                disabled={applied}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm ${
                  applied
                    ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {applied ? 'Applied successfully ✓' : 'Apply AI Suggestions'}
              </button>
            </div>

            {/* Content Details */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Explanation block */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  AI Design Explanations
                </span>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {suggestion.explanation}
                </p>
              </div>

              {/* Proposed items highlights */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Proposal Structure Highlights
                </span>
                
                {suggestion.suggestedConfig.receivers && (
                  <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <span className="text-[11px] font-bold text-gray-600 block">Proposed Receivers ({suggestion.suggestedConfig.receivers.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.suggestedConfig.receivers.map((r, i) => (
                        <span key={i} className="bg-purple-50 text-purple-700 border border-purple-100 rounded px-2 py-0.5 text-[10px] font-medium font-mono">
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {suggestion.suggestedConfig.route && (
                  <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <span className="text-[11px] font-bold text-gray-600 block">Proposed Route Branches</span>
                    <div className="text-[11px] text-gray-500 leading-normal font-mono bg-gray-50 p-2.5 rounded border border-gray-200 max-h-[160px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(suggestion.suggestedConfig.route, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <Sparkles className="w-12 h-12 mb-2 text-purple-200" />
            <span className="text-sm font-semibold text-gray-700">Copilot Advisor Standby</span>
            <span className="text-xs text-gray-400 max-w-sm mt-1">Select a scenario or type custom rules in the left panel to trigger operations planning.</span>
          </div>
        )}
      </div>
    </div>
  );
}
