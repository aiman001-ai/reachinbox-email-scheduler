import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { api } from './services/api';
import { EmailJob, SlackStatus, QueueMetrics } from './types';
import { Plus, Search, Calendar, Send, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledItems, setScheduledItems] = useState<EmailJob[]>([]);
  const [sentItems, setSentItems] = useState<EmailJob[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);

  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getQueueStats();
      setMetrics(data);
    } catch (e) {
      // Backend may be starting
    }
  }, []);

  const fetchSlackStatus = useCallback(async () => {
    try {
      const data = await api.getSlackStatus();
      setSlackStatus(data);
    } catch (e) {
      // Backend may be starting
    }
  }, []);

  const fetchEmails = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;
    if (!isSilent) {
      setLoading(true);
    }
    try {
      if (searchQuery.trim().length > 0) {
        const searchRes = await api.searchEmails(searchQuery.trim(), undefined, user?.id);
        const scheduled = searchRes.results.filter(
          (r) => r.status === 'SCHEDULED' || r.status === 'DELAYED_RATE_LIMIT' || r.status === 'PROCESSING'
        );
        const sent = searchRes.results.filter(
          (r) => r.status === 'SENT' || r.status === 'FAILED'
        );
        setScheduledItems(scheduled);
        setSentItems(sent);
        setScheduledTotal(scheduled.length);
        setSentTotal(sent.length);
      } else {
        const [schedRes, sentRes] = await Promise.all([
          api.getScheduledEmails({ userId: user?.id }),
          api.getSentEmails({ userId: user?.id }),
        ]);
        setScheduledItems(schedRes.items);
        setScheduledTotal(schedRes.total);
        setSentItems(sentRes.items);
        setSentTotal(sentRes.total);
      }
    } catch (err) {
      console.error('Failed to load email tables:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, searchQuery, user?.id]);

  useEffect(() => {
    if (window.location.search.includes('slack=connected')) {
      fetchSlackStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchSlackStatus]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails(false);
      fetchStats();
      fetchSlackStatus();

      const interval = setInterval(() => {
        fetchEmails(true);
        fetchStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchEmails, fetchStats, fetchSlackStatus]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col">
      <Header
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <StatsBar metrics={metrics} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Scheduled</span>
              <span
                className={`ml-0.5 sm:ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'scheduled'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {scheduledTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Sent</span>
              <span
                className={`ml-0.5 sm:ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'sent'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {sentTotal}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, recipient..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchEmails();
                  fetchStats();
                }}
                title="Refresh"
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setIsComposeOpen(true)}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Compose Email</span>
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'scheduled' ? (
          <ScheduledTable
            items={scheduledItems}
            loading={loading && scheduledItems.length === 0}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            items={sentItems}
            loading={loading && sentItems.length === 0}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchEmails(true);
          fetchStats();
        }}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        status={slackStatus}
        onStatusUpdated={fetchSlackStatus}
      />
    </div>
  );
};
