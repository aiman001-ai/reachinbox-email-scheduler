import React from 'react';
import { EmailJob } from '../types';
import { CheckCircle2, XCircle, ExternalLink, Send, Mail } from 'lucide-react';

interface SentTableProps {
  items: EmailJob[];
  loading: boolean;
  onComposeClick: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ items, loading, onComposeClick }) => {
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 space-y-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="animate-pulse flex items-center justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0">
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
            <div className="h-4 bg-slate-800 rounded w-1/3"></div>
            <div className="h-4 bg-slate-800 rounded w-1/6"></div>
            <div className="h-6 bg-slate-800 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <Send className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No sent emails recorded yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
          Dispatched emails processed by the BullMQ worker will be listed here along with Ethereal preview URLs.
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/50 text-slate-400 font-medium uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4 sm:px-6">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sent Time</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((job) => {
              const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.updatedAt);
              const isSent = job.status === 'SENT';

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
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                    {sentDate.toLocaleDateString()} {sentDate.toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4">
                    {isSent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded border border-indigo-500/30 transition"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[11px]">No link</span>
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
