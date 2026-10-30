import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Zap } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogleSuccess } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 font-bold text-xl text-white shadow-xl shadow-indigo-500/25 mb-2">
            RI
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ReachInbox
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Distributed email job scheduling platform for outreach workflows.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#0F172A]/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-white">Sign In</h2>
            <p className="text-xs text-slate-400">
              Continue to your outreach dashboard with Google
            </p>
          </div>

          {/* Google OAuth Login */}
          <div className="flex justify-center py-2">
            <GoogleLogin
              onSuccess={loginWithGoogleSuccess}
              onError={() => console.error('Google Sign In Failed')}
              theme="filled_black"
              shape="rectangular"
              text="signin_with"
              width="320"
            />
          </div>

          {/* Feature Highlights */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>BullMQ persistent delayed job queues</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Redis-backed hourly sender rate limiting</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Mail className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>Full-text search indexing & delivery tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
