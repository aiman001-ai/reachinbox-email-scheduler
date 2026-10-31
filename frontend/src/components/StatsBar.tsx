import React from 'react';
import { QueueMetrics } from '../types';
import { Clock, Send, ShieldCheck, Zap } from 'lucide-react';

interface StatsBarProps {
  metrics: QueueMetrics | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 my-4 sm:my-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-slate-400 truncate block">Scheduled In Queue</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5 sm:mt-1 leading-tight">
            {metrics?.database.scheduled ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-indigo-400 font-medium truncate block mt-0.5">
            {metrics?.queue.delayed ?? 0} delayed in BullMQ
          </span>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5 sm:mt-0">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-slate-400 truncate block">Delivered Emails</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1 leading-tight">
            {metrics?.database.sent ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 truncate block mt-0.5">via Ethereal Fake SMTP</span>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0">
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-slate-400 truncate block">Worker Concurrency</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5 sm:mt-1 leading-tight">
            {metrics?.concurrency ?? 5}x
          </div>
          <span className="text-[10px] sm:text-[11px] text-indigo-400 truncate block mt-0.5">Parallel Processing</span>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5 sm:mt-0">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-slate-400 truncate block">Provider Throttling</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5 sm:mt-1 leading-tight">
            {metrics?.minDelaySeconds ?? 2}s
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-400 truncate block mt-0.5">Min delay per send</span>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
};
