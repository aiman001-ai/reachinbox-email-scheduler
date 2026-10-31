import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Zap, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogleSuccess, loginWithDemo } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col justify-center items-center px-3 sm:px-6 lg:px-8 py-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 sm:w-80 h-64 sm:h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-5 sm:space-y-6">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 font-bold text-lg sm:text-xl text-white shadow-xl shadow-indigo-500/25 mb-1 sm:mb-2">
            RI
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            ReachInbox
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto">
            Distributed email job scheduling platform for outreach workflows.
          </p>
        </div>

        <div className="bg-[#0F172A]/90 border border-slate-800 rounded-2xl p-4 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5 sm:space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-base sm:text-lg font-semibold text-white">Sign In to Outreach Platform</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Access scheduled queues, email sequence dispatch, and analytics
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center py-1 max-w-full overflow-hidden">
              <GoogleLogin
                onSuccess={loginWithGoogleSuccess}
                onError={() => {
                  console.warn('Google Sign In failed. Switching to demo session.');
                  loginWithDemo();
                }}
                theme="filled_black"
                shape="rectangular"
                text="signin_with"
                width="280"
              />
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={loginWithDemo}
                className="text-[11px] text-slate-500 hover:text-indigo-400 transition underline underline-offset-4 cursor-pointer"
              >
                Continue with Demo Workspace
              </button>
            </div>
          </div>

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
