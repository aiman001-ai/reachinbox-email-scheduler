import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, UploadCloud, FileText, CheckCircle2, Clock, AlertCircle, Zap, Calendar, Loader2 } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [sender, setSender] = useState(user?.email || 'outreach@reachinbox.ai');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [startTime, setStartTime] = useState<string>('');
  const [isTimeConfirmed, setIsTimeConfirmed] = useState(false);
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setSender(user.email);
    }
  }, [user]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMessage(null);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const clean = Array.from(new Set(matches.map((m) => m.toLowerCase().trim())));

        if (clean.length > 0) {
          setParsedRecipients(clean);
        } else {
          setErrorMessage('No valid email addresses found in the selected file.');
        }
      } catch (err) {
        console.error('File parsing error:', err);
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
      setUploading(false);
    };

    reader.readAsText(file);
  };

  const getCombinedRecipients = (): string[] => {
    const manualList = manualRecipients
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));

    const combined = Array.from(new Set([...manualList, ...parsedRecipients]));
    return combined;
  };

  const totalDetected = getCombinedRecipients().length;

  const setQuickTime = (minutesFromNow: number) => {
    const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setStartTime(formatted);
    setIsTimeConfirmed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const recipients = getCombinedRecipients();

    if (!sender.trim()) {
      setErrorMessage('Please enter a sender email address.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter an email subject line.');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Please enter email body content.');
      return;
    }
    if (recipients.length === 0) {
      setErrorMessage('Please add at least one recipient email address or upload a CSV file.');
      return;
    }

    setSubmitting(true);
    try {
      const effectiveStartTime =
        scheduleMode === 'later' && startTime
          ? new Date(startTime).toISOString()
          : new Date().toISOString();

      await api.scheduleEmails({
        userId: user?.id,
        sender: sender.trim(),
        recipients,
        subject: subject.trim(),
        body: body.trim(),
        startTime: effectiveStartTime,
        delayBetweenSeconds,
        hourlyLimit,
      });

      setSubject('');
      setBody('');
      setManualRecipients('');
      setParsedRecipients([]);
      setUploadedFileName(null);
      setStartTime('');
      setIsTimeConfirmed(false);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || err?.message || 'Failed to schedule emails. Please check your network.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800/80 sticky top-0 bg-[#0F172A]/90 backdrop-blur-md z-10">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Compose & Schedule Sequence</h2>
            <p className="text-xs text-slate-400">Schedule cold email outreach campaigns</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1">Sender Email</label>
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. outreach@reachinbox.ai"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Partnership opportunity"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Email Body</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
            />
          </div>

          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Email Leads / Recipients</span>
              {totalDetected > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {totalDetected} recipient{totalDetected > 1 ? 's' : ''} ready
                </span>
              ) : (
                <span className="text-[11px] text-amber-400/90 font-medium">
                  Add leads via CSV or type below
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer transition bg-slate-900/30 hover:bg-indigo-500/5"
            >
              <UploadCloud className="w-6 h-6 text-indigo-400 mx-auto mb-1" />
              <div className="text-slate-300 font-medium">
                {uploadedFileName ? (
                  <span className="text-emerald-400 font-mono text-[11px] flex items-center justify-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {uploadedFileName} ({parsedRecipients.length} leads loaded)
                  </span>
                ) : (
                  'Click to upload CSV or TXT lead list'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically extracts all valid email addresses
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Or paste email addresses (comma or newline separated):
              </label>
              <textarea
                rows={2}
                value={manualRecipients}
                onChange={(e) => setManualRecipients(e.target.value)}
                placeholder="lead1@company.com, lead2@startup.io..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-medium flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>When should emails send?</span>
              </label>

              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('now');
                    setStartTime('');
                    setIsTimeConfirmed(false);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    scheduleMode === 'now'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>Send Now</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('later');
                    if (!startTime) setQuickTime(5);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    scheduleMode === 'later'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Schedule Later</span>
                  </span>
                </button>
              </div>
            </div>

            {scheduleMode === 'now' ? (
              <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>Emails will begin dispatching immediately with your configured 2-second delay.</span>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setIsTimeConfirmed(false);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsTimeConfirmed(true)}
                    className={`px-4 py-2 font-medium rounded-lg text-xs transition flex items-center justify-center gap-1.5 ${
                      isTimeConfirmed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isTimeConfirmed ? 'OK (Confirmed)' : 'OK / Set Time'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => setQuickTime(5)}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition"
                  >
                    +5 mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(15)}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition"
                  >
                    +15 mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(60)}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition"
                  >
                    +1 hour
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Delay Between Sends (sec)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={delayBetweenSeconds}
                onChange={(e) => setDelayBetweenSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Prevents SMTP provider throttling</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Hourly Limit / Sender</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Exceeding shifts jobs to next hour</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {totalDetected > 0 ? (
                <span className="text-slate-300">Ready to schedule <strong>{totalDetected}</strong> email{totalDetected > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-amber-400/90 font-medium">⚠️ Add at least 1 lead to enable</span>
              )}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploading}
                className="px-6 py-2.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition flex items-center gap-2 text-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : totalDetected > 0 ? (
                  `Schedule (${totalDetected}) Emails`
                ) : (
                  'Schedule Emails'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
