import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, UploadCloud, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

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

  const [startTime, setStartTime] = useState<string>('');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMessage(null);

    try {
      const data = await api.uploadLeadsFile(file);
      setParsedRecipients(data.emails);
      setUploadedFileName(file.name);
    } catch (err) {
      setErrorMessage((err as any)?.response?.data?.error || 'Failed to process leads file');
    } finally {
      setUploading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const recipients = getCombinedRecipients();

    if (!sender.trim()) {
      setErrorMessage('Sender email is required');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Subject line is required');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Email body content is required');
      return;
    }
    if (recipients.length === 0) {
      setErrorMessage('Please add at least one valid recipient or upload a CSV file');
      return;
    }

    setSubmitting(true);
    try {
      await api.scheduleEmails({
        userId: user?.id,
        sender,
        recipients,
        subject,
        body,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delayBetweenSeconds,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage((err as any)?.response?.data?.error || 'Failed to schedule emails');
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
              <span>{errorMessage}</span>
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
              required
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
              required
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
              required
            />
          </div>

          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Email Leads / Recipients</span>
              {totalDetected > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {totalDetected} valid recipient{totalDetected > 1 ? 's' : ''} detected
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
                Automatically extracts and validates all email addresses
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Leave blank to dispatch immediately</span>
            </div>

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

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-3">
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
              className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Scheduling...' : `Schedule ${totalDetected > 0 ? `(${totalDetected})` : ''} Emails`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
