import React from 'react';
import { QueueMetrics } from '../types';
import { Clock, Send, ShieldCheck, Zap } from 'lucide-react';

interface StatsBarProps {
  metrics: QueueMetrics | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400">Scheduled In Queue</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {metrics?.database.scheduled ?? 0}
          </div>
          <span className="text-[11px] text-indigo-400 font-medium">
            {metrics?.queue.delayed ?? 0} delayed in BullMQ
          </span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400">Delivered Emails</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {metrics?.database.sent ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">via Ethereal Fake SMTP</span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Send className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400">Worker Concurrency</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {metrics?.concurrency ?? 5}x
          </div>
          <span className="text-[11px] text-indigo-400">Parallel Job Processing</span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Zap className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400">Provider Throttling</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {metrics?.minDelaySeconds ?? 2}s
          </div>
          <span className="text-[11px] text-emerald-400">Min safe delay between sends</span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
