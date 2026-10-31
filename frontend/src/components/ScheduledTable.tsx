import React from 'react';
import { EmailJob } from '../types';
import { Clock, AlertTriangle, Calendar, Mail } from 'lucide-react';

interface ScheduledTableProps {
  items: EmailJob[];
  loading: boolean;
  onComposeClick: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({ items, loading, onComposeClick }) => {
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 sm:p-8 space-y-3 sm:space-y-4">
        <div className="md:hidden space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                <div className="h-5 bg-slate-800 rounded w-20"></div>
              </div>
              <div className="h-3.5 bg-slate-800/80 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800/60 rounded w-1/3"></div>
            </div>
          ))}
        </div>

        <div className="hidden md:block space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="animate-pulse flex items-center justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0">
              <div className="h-4 bg-slate-800 rounded w-1/4"></div>
              <div className="h-4 bg-slate-800 rounded w-1/3"></div>
              <div className="h-4 bg-slate-800 rounded w-1/6"></div>
              <div className="h-6 bg-slate-800 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 sm:p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-200">No scheduled emails in queue</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
          There are currently no delayed jobs queued in BullMQ. Schedule your first outreach sequence.
        </p>
        <button
          onClick={onComposeClick}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition"
        >
          Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
      {/* Mobile Card List */}
      <div className="md:hidden divide-y divide-slate-800/60">
        {items.map((job) => {
          const scheduledDate = new Date(job.scheduledAt);
          const isRateDelayed = job.status === 'DELAYED_RATE_LIMIT';

          return (
            <div key={job.id} className="p-3.5 sm:p-4 space-y-2 hover:bg-slate-800/20 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-semibold text-slate-200 text-xs truncate">{job.recipient}</span>
                </div>
                {isRateDelayed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    Rate Limited
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    Scheduled
                  </span>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-200 truncate">{job.subject}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{job.body}</div>
              </div>

              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/50">
                <span className="truncate max-w-[140px] text-slate-500 font-mono">
                  From: {job.sender}
                </span>
                <span className="font-mono text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {scheduledDate.toLocaleDateString()} {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/50 text-slate-400 font-medium uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4 sm:px-6">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender</th>
              <th className="py-3.5 px-4">Scheduled For</th>
              <th className="py-3.5 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              const isRateDelayed = job.status === 'DELAYED_RATE_LIMIT';

              return (
                <tr key={job.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 sm:px-6 font-medium text-slate-200 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{job.recipient}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <div className="truncate max-w-[240px] font-medium">{job.subject}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[240px]">{job.body}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                    {job.sender}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                    {scheduledDate.toLocaleDateString()} {scheduledDate.toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4">
                    {isRateDelayed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        Rate Limit Delayed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        <Clock className="w-3 h-3" />
                        Scheduled
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
