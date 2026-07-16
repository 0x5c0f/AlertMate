
import React, { useState, useEffect } from 'react';
import { AlertmanagerConfig } from '../types';
import { Terminal, Download, RefreshCw, CheckCircle, AlertTriangle, FileCode, Play, Globe, ExternalLink, HelpCircle } from 'lucide-react';

interface ValidationAndReloadProps {
  config: AlertmanagerConfig;
  targetUrl: string;
  onTargetUrlChange: (url: string) => void;
}

export default function ValidationAndReload({ config, targetUrl, onTargetUrlChange }: ValidationAndReloadProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  
  // Validation API result state
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    yaml: string;
    errors: string[];
    warnings: string[];
    output: string;
  } | null>(null);

  // Reload action feedback state
  const [reloadLog, setReloadLog] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  // Function to call `/api/validate`
  const handleValidateConfig = async () => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (err: any) {
      setValidationResult({
        valid: false,
        yaml: '',
        errors: [err.message || 'Validation request failed'],
        warnings: [],
        output: `FAILED: Network Error calling validation service:\n  ✖ ${err.message}`
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Run initial validation when config changes
  useEffect(() => {
    handleValidateConfig();
  }, [config]);

  // Function to call `/api/reload`
  const handleReloadConfig = async () => {
    setIsReloading(true);
    setReloadLog(null);
    try {
      const res = await fetch('/api/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl })
      });
      const data = await res.json();
      setReloadLog({
        success: data.success,
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err: any) {
      setReloadLog({
        success: false,
        message: `Network failure connecting to Configurer reloading proxy: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsReloading(false);
    }
  };

  // Download alertmanager.yml handler
  const handleDownloadYaml = () => {
    if (!validationResult || !validationResult.yaml) return;
    const blob = new Blob([validationResult.yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alertmanager.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Target config and Deploy bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100 flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-blue-500" />
          Target Alertmanager Cluster Endpoint
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
              Alertmanager Base URL
              <HelpCircle className="w-3.5 h-3.5 text-gray-400" title="The URL of your running Alertmanager instance. The application proxies reload notifications to this URL." />
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
              <span className="bg-gray-50 border-r border-gray-300 text-gray-500 text-xs px-3 flex items-center justify-center font-mono">
                URL
              </span>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => onTargetUrlChange(e.target.value)}
                placeholder="http://localhost:9093"
                className="w-full text-xs p-2.5 outline-none bg-white font-mono"
              />
            </div>
            <span className="text-[10px] text-gray-400 mt-1 block">
              Default standard is `http://localhost:9093`. For remote servers, ensure reload lifecycle is enabled using `--web.enable-lifecycle`.
            </span>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-end pt-1 shrink-0 w-full md:w-auto">
            <button
              onClick={handleDownloadYaml}
              disabled={!validationResult?.valid}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 text-xs font-bold rounded-lg border border-gray-300 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download alertmanager.yml
            </button>
            <button
              onClick={handleReloadConfig}
              disabled={isReloading || !validationResult?.valid}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              {isReloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Trigger /-/reload Hot Reload
            </button>
          </div>
        </div>

        {/* Reload Log Output Banner */}
        {reloadLog && (
          <div
            className={`p-4 border rounded-xl flex items-start gap-3 text-xs leading-relaxed ${
              reloadLog.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {reloadLog.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span>{reloadLog.success ? 'Configuration Hot-Reload Succeeded' : 'Configuration Hot-Reload Failed'}</span>
                <span className="text-[10px] font-normal text-gray-400 font-mono">[{reloadLog.timestamp}]</span>
              </div>
              <p className="font-mono text-[11px] leading-tight select-all">{reloadLog.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Validation Terminal Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[460px]">
        {/* Terminal Logger Output */}
        <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col font-mono shadow-md text-gray-300">
          {/* Header */}
          <div className="p-3 bg-gray-950 border-b border-gray-800 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5 uppercase font-bold tracking-wider">
              <Terminal className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              amtool validation terminal shell
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            </div>
          </div>

          {/* Terminal content */}
          <div className="flex-1 p-4 overflow-auto text-xs leading-relaxed space-y-2 select-text">
            <div className="text-gray-500">$ amtool check-config /tmp/alertmanager.yml</div>
            {isValidating ? (
              <div className="text-blue-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Executing static validation rules...
              </div>
            ) : validationResult ? (
              <pre className="whitespace-pre-wrap leading-tight text-gray-200">
                {validationResult.output}
              </pre>
            ) : (
              <div className="text-gray-500 italic">Terminal idle. Waiting for configuration updates...</div>
            )}
          </div>
        </div>

        {/* Live YAML Syntax View */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5 uppercase font-bold tracking-wider">
              <FileCode className="w-3.5 h-3.5 text-orange-500" />
              Generated alertmanager.yml preview
            </span>
            <span className="bg-orange-50 text-orange-700 border border-orange-100 rounded px-1.5 py-0.2 text-[9px] font-bold font-mono">
              YAML
            </span>
          </div>

          {/* Code preview block */}
          <div className="flex-1 p-4 overflow-auto bg-gray-50 text-xs font-mono text-gray-800 leading-tight border-none outline-none select-all whitespace-pre">
            {isValidating ? (
              <div className="text-gray-400 italic">Compiling YAML file...</div>
            ) : validationResult && validationResult.yaml ? (
              <code>{validationResult.yaml}</code>
            ) : (
              <div className="text-gray-400 italic">No valid YAML compiled yet. Try reviewing your components.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
