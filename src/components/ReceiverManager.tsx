
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receiver, SlackConfig, WechatConfig, DingtalkConfig, WebhookConfig, EmailConfig, PagerdutyConfig } from '../types';
import { Plus, Trash2, Mail, Slack, Send, Layers, Settings, MessageSquare, AlertCircle, Phone } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface ReceiverManagerProps {
  receivers: Receiver[];
  onChange: (receivers: Receiver[]) => void;
}

export default function ReceiverManager({ receivers, onChange }: ReceiverManagerProps) {
  const { t } = useTranslation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [activeReceiverId, setActiveReceiverId] = useState<string>(receivers[0]?.id || '');
  const [isAdding, setIsAdding] = useState(false);
  const [newReceiverName, setNewReceiverName] = useState('');

  const activeReceiver = receivers.find((r) => r.id === activeReceiverId);

  const handleAddReceiver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceiverName.trim()) return;
    
    // Check for duplicate name
    if (receivers.some(r => r.name.trim().toLowerCase() === newReceiverName.trim().toLowerCase())) {
      setAlertMessage(t('receivers.duplicateName'));
      return;
    }

    const newRec: Receiver = {
      id: `rec-${Date.now()}`,
      name: newReceiverName.trim()
    };

    const updated = [...receivers, newRec];
    onChange(updated);
    setActiveReceiverId(newRec.id);
    setNewReceiverName('');
    setIsAdding(false);
  };

  const handleDeleteReceiver = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (receivers.length <= 1) {
      setAlertMessage(t('receivers.lastReceiverWarning'));
      return;
    }
    setConfirmDeleteId(id);
  };

  const updateActiveReceiver = (updater: (rec: Receiver) => Receiver) => {
    const updated = receivers.map(r => r.id === activeReceiverId ? updater(r) : r);
    onChange(updated);
  };

  // Channel Config Handlers
  const addSlackConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      slack_configs: [...(r.slack_configs || []), { channel: '#alerts', username: 'Alertmanager' }]
    }));
  };

  const removeSlackConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      slack_configs: (r.slack_configs || []).filter((_, i) => i !== idx)
    }));
  };

  const addWechatConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      wechat_configs: [...(r.wechat_configs || []), { agent_id: '1000001', to_party: '1' }]
    }));
  };

  const removeWechatConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      wechat_configs: (r.wechat_configs || []).filter((_, i) => i !== idx)
    }));
  };

  const addDingtalkConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      dingtalk_configs: [...(r.dingtalk_configs || []), { webhook_url: 'https://oapi.dingtalk.com/robot/send?access_token=' }]
    }));
  };

  const removeDingtalkConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      dingtalk_configs: (r.dingtalk_configs || []).filter((_, i) => i !== idx)
    }));
  };

  const addWebhookConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      webhook_configs: [...(r.webhook_configs || []), { url: 'http://' }]
    }));
  };

  const removeWebhookConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      webhook_configs: (r.webhook_configs || []).filter((_, i) => i !== idx)
    }));
  };

  const addEmailConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      email_configs: [...(r.email_configs || []), { to: 'ops@example.com' }]
    }));
  };

  const removeEmailConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      email_configs: (r.email_configs || []).filter((_, i) => i !== idx)
    }));
  };

  const addPagerdutyConfig = () => {
    updateActiveReceiver(r => ({
      ...r,
      pagerduty_configs: [...(r.pagerduty_configs || []), { severity: 'critical' }]
    }));
  };

  const removePagerdutyConfig = (idx: number) => {
    updateActiveReceiver(r => ({
      ...r,
      pagerduty_configs: (r.pagerduty_configs || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sidebar - Receiver List */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">{t('receivers.title')} ({receivers.length})</span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 border border-gray-200 transition-colors"
            title={t('receivers.tooltips.createReceiver')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create New Receiver Form */}
        {isAdding && (
          <form onSubmit={handleAddReceiver} className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-xs font-semibold text-gray-500 mb-2">{t('receivers.newReceiverName')}</div>
            <input
              type="text"
              required
              placeholder="e.g., mail-ops-team"
              value={newReceiverName}
              onChange={(e) => setNewReceiverName(e.target.value)}
              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none mb-2"
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
              >
                {t('common.add')}
              </button>
            </div>
          </form>
        )}

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {receivers.map((rec) => {
            const isActive = rec.id === activeReceiverId;
            const channelCount = 
              (rec.slack_configs?.length || 0) + 
              (rec.wechat_configs?.length || 0) + 
              (rec.dingtalk_configs?.length || 0) + 
              (rec.webhook_configs?.length || 0) + 
              (rec.email_configs?.length || 0) +
              (rec.pagerduty_configs?.length || 0);

            return (
              <div
                key={rec.id}
                onClick={() => setActiveReceiverId(rec.id)}
                className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50/75 border-blue-200 text-blue-900 font-medium'
                    : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex flex-col gap-0.5 truncate pr-2">
                  <span className="text-xs truncate">{rec.name}</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {channelCount === 0 ? t('receivers.noIntegrations') : t('receivers.integrationCount', { count: channelCount })}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteReceiver(rec.id, e)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-gray-100"
                  title={t('receivers.tooltips.deleteReceiver')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Content */}
      <div className="md:col-span-3 bg-white border border-gray-200 rounded-xl p-6 h-[calc(100vh-180px)] min-h-[500px] overflow-y-auto flex flex-col">
        {activeReceiver ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-100">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Settings className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t('receivers.receiverConfig')}</div>
                <input
                  type="text"
                  value={activeReceiver.name}
                  onChange={(e) => {
                    const newName = e.target.value.trim().replace(/\s+/g, '-');
                    updateActiveReceiver(r => ({ ...r, name: newName }));
                  }}
                  className="text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 outline-none transition-colors py-0.5"
                />
              </div>
            </div>

            {/* Quick Add Integrations Toolbox */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-700 mb-3">{t('receivers.addIntegrations')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={addSlackConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-yellow-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-yellow-50/30 transition-all"
                >
                  <Slack className="w-3.5 h-3.5 text-yellow-500" />
                  {t('receivers.integrations.slack')}
                </button>
                <button
                  type="button"
                  onClick={addWechatConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-green-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-green-50/30 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                  {t('receivers.integrations.wechat')}
                </button>
                <button
                  type="button"
                  onClick={addDingtalkConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-blue-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-blue-50/30 transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-blue-500" />
                  {t('receivers.integrations.dingtalk')}
                </button>
                <button
                  type="button"
                  onClick={addEmailConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-purple-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-purple-50/30 transition-all"
                >
                  <Mail className="w-3.5 h-3.5 text-purple-500" />
                  {t('receivers.integrations.email')}
                </button>
                <button
                  type="button"
                  onClick={addWebhookConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all"
                >
                  <Layers className="w-3.5 h-3.5 text-gray-600" />
                  {t('receivers.integrations.webhook')}
                </button>
                <button
                  type="button"
                  onClick={addPagerdutyConfig}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 hover:border-red-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-red-50/30 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-red-500" />
                  {t('receivers.integrations.pagerduty')}
                </button>
              </div>
            </div>

            {/* Active Integrations Form list */}
            <div className="flex-1 space-y-6">
              {/* slack_configs */}
              {activeReceiver.slack_configs && activeReceiver.slack_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-yellow-600 font-semibold text-xs">
                      <Slack className="w-4 h-4" /> {t('receivers.slack.title', { count: activeReceiver.slack_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.slack_configs.map((sc, sIdx) => (
                      <div key={sIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removeSlackConfig(sIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removeSlack')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.slack.channel')}</label>
                            <input
                              type="text"
                              value={sc.channel || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.slack_configs || [])];
                                  list[sIdx] = { ...list[sIdx], channel: val };
                                  return { ...r, slack_configs: list };
                                });
                              }}
                              placeholder="#ops-alerts"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.slack.webhookUrl')}</label>
                            <input
                              type="password"
                              value={sc.api_url || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.slack_configs || [])];
                                  list[sIdx] = { ...list[sIdx], api_url: val };
                                  return { ...r, slack_configs: list };
                                });
                              }}
                              placeholder="https://hooks.slack.com/services/..."
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.slack.textTemplate')}</label>
                            <textarea
                              rows={2}
                              value={sc.text || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.slack_configs || [])];
                                  list[sIdx] = { ...list[sIdx], text: val };
                                  return { ...r, slack_configs: list };
                                });
                              }}
                              placeholder="Summary: {{ .CommonAnnotations.summary }}\nDescription: {{ .CommonAnnotations.description }}"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* wechat_configs */}
              {activeReceiver.wechat_configs && activeReceiver.wechat_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-green-600 font-semibold text-xs">
                      <MessageSquare className="w-4 h-4" /> {t('receivers.wechat.title', { count: activeReceiver.wechat_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.wechat_configs.map((wc, wIdx) => (
                      <div key={wIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removeWechatConfig(wIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removeWechat')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.wechat.corpId')}</label>
                            <input
                              type="text"
                              value={wc.corp_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.wechat_configs || [])];
                                  list[wIdx] = { ...list[wIdx], corp_id: val };
                                  return { ...r, wechat_configs: list };
                                });
                              }}
                              placeholder="ww123456789abc"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.wechat.agentId')}</label>
                            <input
                              type="text"
                              value={wc.agent_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.wechat_configs || [])];
                                  list[wIdx] = { ...list[wIdx], agent_id: val };
                                  return { ...r, wechat_configs: list };
                                });
                              }}
                              placeholder="1000002"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.wechat.apiSecret')}</label>
                            <input
                              type="password"
                              value={wc.api_secret || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.wechat_configs || [])];
                                  list[wIdx] = { ...list[wIdx], api_secret: val };
                                  return { ...r, wechat_configs: list };
                                });
                              }}
                              placeholder="••••••••••••••••"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.wechat.toUser')}</label>
                            <input
                              type="text"
                              value={wc.to_user || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.wechat_configs || [])];
                                  list[wIdx] = { ...list[wIdx], to_user: val };
                                  return { ...r, wechat_configs: list };
                                });
                              }}
                              placeholder="UserID1|UserID2"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.wechat.toParty')}</label>
                            <input
                              type="text"
                              value={wc.to_party || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.wechat_configs || [])];
                                  list[wIdx] = { ...list[wIdx], to_party: val };
                                  return { ...r, wechat_configs: list };
                                });
                              }}
                              placeholder="DepartmentID1|DepartmentID2"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="flex items-center pt-5">
                            <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={wc.send_resolved ?? true}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  updateActiveReceiver(r => {
                                    const list = [...(r.wechat_configs || [])];
                                    list[wIdx] = { ...list[wIdx], send_resolved: val };
                                    return { ...r, wechat_configs: list };
                                  });
                                }}
                                className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                              />
                              {t('receivers.sendResolved')}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* dingtalk_configs */}
              {activeReceiver.dingtalk_configs && activeReceiver.dingtalk_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs">
                      <Send className="w-4 h-4" /> {t('receivers.dingtalk.title', { count: activeReceiver.dingtalk_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.dingtalk_configs.map((dc, dIdx) => (
                      <div key={dIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removeDingtalkConfig(dIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removeDingtalk')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.dingtalk.webhookUrl')}</label>
                            <input
                              type="password"
                              value={dc.webhook_url}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.dingtalk_configs || [])];
                                  list[dIdx] = { ...list[dIdx], webhook_url: val };
                                  return { ...r, dingtalk_configs: list };
                                });
                              }}
                              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.dingtalk.secret')}</label>
                              <input
                                type="password"
                                value={dc.secret || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateActiveReceiver(r => {
                                    const list = [...(r.dingtalk_configs || [])];
                                    list[dIdx] = { ...list[dIdx], secret: val };
                                    return { ...r, dingtalk_configs: list };
                                  });
                                }}
                                placeholder="SEC..."
                                className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="flex items-center pt-5">
                              <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dc.send_resolved ?? true}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    updateActiveReceiver(r => {
                                      const list = [...(r.dingtalk_configs || [])];
                                      list[dIdx] = { ...list[dIdx], send_resolved: val };
                                      return { ...r, dingtalk_configs: list };
                                    });
                                  }}
                                  className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                                />
                                {t('receivers.sendResolved')}
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* email_configs */}
              {activeReceiver.email_configs && activeReceiver.email_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-purple-600 font-semibold text-xs">
                      <Mail className="w-4 h-4" /> {t('receivers.email.title', { count: activeReceiver.email_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.email_configs.map((ec, eIdx) => (
                      <div key={eIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removeEmailConfig(eIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removeEmail')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.email.to')}</label>
                            <input
                              type="email"
                              value={ec.to}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.email_configs || [])];
                                  list[eIdx] = { ...list[eIdx], to: val };
                                  return { ...r, email_configs: list };
                                });
                              }}
                              placeholder="ops-oncall@company.com"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.email.from')}</label>
                            <input
                              type="email"
                              value={ec.from || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.email_configs || [])];
                                  list[eIdx] = { ...list[eIdx], from: val };
                                  return { ...r, email_configs: list };
                                });
                              }}
                              placeholder="alerts@prometheus.company.com"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.email.smarthost')}</label>
                            <input
                              type="text"
                              value={ec.smarthost || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.email_configs || [])];
                                  list[eIdx] = { ...list[eIdx], smarthost: val };
                                  return { ...r, email_configs: list };
                                });
                              }}
                              placeholder="smtp.gmail.com:587"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="flex items-center pt-5">
                            <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ec.send_resolved ?? true}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  updateActiveReceiver(r => {
                                    const list = [...(r.email_configs || [])];
                                    list[eIdx] = { ...list[eIdx], send_resolved: val };
                                    return { ...r, email_configs: list };
                                  });
                                }}
                                className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                              />
                              {t('receivers.sendResolved')}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* webhook_configs */}
              {activeReceiver.webhook_configs && activeReceiver.webhook_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-700 font-semibold text-xs">
                      <Layers className="w-4 h-4" /> {t('receivers.webhook.title', { count: activeReceiver.webhook_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.webhook_configs.map((whc, whIdx) => (
                      <div key={whIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removeWebhookConfig(whIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removeWebhook')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.webhook.url')}</label>
                            <input
                              type="text"
                              value={whc.url}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.webhook_configs || [])];
                                  list[whIdx] = { ...list[whIdx], url: val };
                                  return { ...r, webhook_configs: list };
                                });
                              }}
                              placeholder="http://alert-gateway.local/api/alerts"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={whc.send_resolved ?? true}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  updateActiveReceiver(r => {
                                    const list = [...(r.webhook_configs || [])];
                                    list[whIdx] = { ...list[whIdx], send_resolved: val };
                                    return { ...r, webhook_configs: list };
                                  });
                                }}
                                className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                              />
                              {t('receivers.sendResolved')}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* pagerduty_configs */}
              {activeReceiver.pagerduty_configs && activeReceiver.pagerduty_configs.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-red-600 font-semibold text-xs">
                      <Phone className="w-4 h-4" /> {t('receivers.pagerduty.title', { count: activeReceiver.pagerduty_configs.length })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeReceiver.pagerduty_configs.map((pd, pIdx) => (
                      <div key={pIdx} className="relative bg-white border border-gray-200 rounded-lg p-4 pt-6 shadow-sm">
                        <button
                          onClick={() => removePagerdutyConfig(pIdx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('receivers.tooltips.removePagerduty')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.pagerduty.routingKey')}</label>
                            <input
                              type="password"
                              value={pd.routing_key || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.pagerduty_configs || [])];
                                  list[pIdx] = { ...list[pIdx], routing_key: val };
                                  return { ...r, pagerduty_configs: list };
                                });
                              }}
                              placeholder="e.g. pd-service-routing-key"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.pagerduty.serviceKey')}</label>
                            <input
                              type="password"
                              value={pd.service_key || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.pagerduty_configs || [])];
                                  list[pIdx] = { ...list[pIdx], service_key: val };
                                  return { ...r, pagerduty_configs: list };
                                });
                              }}
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{t('receivers.pagerduty.clientUrl')}</label>
                            <input
                              type="text"
                              value={pd.client_url || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveReceiver(r => {
                                  const list = [...(r.pagerduty_configs || [])];
                                  list[pIdx] = { ...list[pIdx], client_url: val };
                                  return { ...r, pagerduty_configs: list };
                                });
                              }}
                              placeholder="https://prometheus.mycompany.com"
                              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="flex items-center pt-5">
                            <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pd.send_resolved ?? true}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  updateActiveReceiver(r => {
                                    const list = [...(r.pagerduty_configs || [])];
                                    list[pIdx] = { ...list[pIdx], send_resolved: val };
                                    return { ...r, pagerduty_configs: list };
                                  });
                                }}
                                className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                              />
                              {t('receivers.sendResolved')}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State when no configs are added */}
              {(!activeReceiver.slack_configs || activeReceiver.slack_configs.length === 0) &&
               (!activeReceiver.wechat_configs || activeReceiver.wechat_configs.length === 0) &&
               (!activeReceiver.dingtalk_configs || activeReceiver.dingtalk_configs.length === 0) &&
               (!activeReceiver.webhook_configs || activeReceiver.webhook_configs.length === 0) &&
               (!activeReceiver.email_configs || activeReceiver.email_configs.length === 0) &&
               (!activeReceiver.pagerduty_configs || activeReceiver.pagerduty_configs.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 rounded-xl text-gray-400">
                  <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
                  <span className="text-xs">{t('receivers.emptyReceiver')}</span>
                  <span className="text-[10px] text-gray-400 mt-1">{t('receivers.emptyReceiverHint')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <AlertCircle className="w-10 h-10 mb-2 text-gray-300" />
            <span className="text-sm">{t('receivers.noReceivers')}</span>
            <span className="text-xs text-gray-400 mt-1">{t('receivers.noReceiversHint')}</span>
          </div>
        )}
      </div>
      <ConfirmDialog open={!!alertMessage} title={t('receivers.title')} message={alertMessage || ''} confirmLabel={t('common.ok')} showCancel={false} variant="warning" onConfirm={() => setAlertMessage(null)} onCancel={() => setAlertMessage(null)} />
      <ConfirmDialog open={!!confirmDeleteId} title={t('receivers.deleteReceiver')} message={t('receivers.deleteConfirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} variant="danger" onConfirm={() => { if (confirmDeleteId) { const updated = receivers.filter(r => r.id !== confirmDeleteId); onChange(updated); if (activeReceiverId === confirmDeleteId) { setActiveReceiverId(updated[0]?.id || ''); } setConfirmDeleteId(null); } }} onCancel={() => setConfirmDeleteId(null)} />
    </div>
  );
}
