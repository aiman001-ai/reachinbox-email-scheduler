import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SlackStatus } from '../types';
import { X, Hash, CheckCircle2, AlertCircle, Send, Link as LinkIcon } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus | null;
  onStatusUpdated: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({ isOpen, onClose, status, onStatusUpdated }) => {
  const { user } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setTestResult(null);

    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      setErrorMessage('Please provide a valid Slack webhook URL (https://hooks.slack.com/...)');
      return;
    }

    setLoading(true);
    try {
      await api.connectSlackWebhook(webhookUrl.trim(), channel.trim(), user?.id);
      onStatusUpdated();
    } catch (err) {
      setErrorMessage((err as any)?.response?.data?.error || 'Failed to connect Slack webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectSlack(user?.id);
      onStatusUpdated();
    } catch (err) {
      setErrorMessage('Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await api.triggerSlackTestAlert(user?.email || 'outreach@reachinbox.ai', 200, user?.id);
      setTestResult(res.message);
    } catch (err) {
      setErrorMessage('Failed to dispatch test notification');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/slack/auth-url?userId=${encodeURIComponent(user?.id || 'default-user')}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setErrorMessage('Could not initiate Slack OAuth');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#0F172A]/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#4A154B] flex items-center justify-center text-white font-bold flex-shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">Slack Rate Limit Alerts</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Live alerts when hourly limits trigger</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {testResult && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {status?.connected ? (
            <div className="space-y-4">
              <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Slack Integration Active</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Alerts will be pushed to channel <strong className="text-white">{status.channel}</strong> in{' '}
                  <strong className="text-white">{status.teamName}</strong>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={loading}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Live Test Alert</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="py-2 px-3 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 font-medium rounded-lg border border-slate-700 transition text-center"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-300 text-xs leading-relaxed">
                Connect your Slack workspace so your team is instantly notified when a sender reaches their hourly dispatch threshold.
              </p>

              <form onSubmit={handleConnectWebhook} className="space-y-3 p-3.5 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Connect via Webhook</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Slack Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-sm sm:text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target Channel</label>
                  <input
                    type="text"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    placeholder="#email-alerts"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-sm sm:text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  {loading ? 'Connecting...' : 'Save & Enable Slack Alerts'}
                </button>
              </form>

              <div className="text-center pt-1">
                <span className="text-[11px] text-slate-500">or if configured in environment: </span>
                <button
                  type="button"
                  onClick={handleOAuthConnect}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline"
                >
                  Authorize via Slack OAuth v2
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
