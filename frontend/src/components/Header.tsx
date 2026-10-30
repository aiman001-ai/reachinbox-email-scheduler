import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SlackStatus } from '../types';
import { LogOut, ExternalLink, Hash, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  slackStatus: SlackStatus | null;
  onOpenSlackModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ slackStatus, onOpenSlackModal }) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            RI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">ReachInbox</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400">Email Job Scheduler</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition"
          >
            <span>Live Queue Board</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>

          <button
            onClick={onOpenSlackModal}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>
              {slackStatus?.connected
                ? `Slack: ${slackStatus.channel || 'Connected'}`
                : 'Connect Slack'}
            </span>
            {slackStatus?.connected ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
          </button>

          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <img
                src={
                  user.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.name || 'User'
                  )}&background=6366f1&color=fff`
                }
                alt={user.name || 'User avatar'}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
              <div className="hidden md:block text-left">
                <div className="text-xs font-medium text-slate-200 leading-none">{user.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[150px]">
                  {user.email}
                </div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
