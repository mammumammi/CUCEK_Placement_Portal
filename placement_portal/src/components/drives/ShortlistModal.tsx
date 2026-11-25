'use client';

/**
 * @fileoverview Shortlist PDF Upload & Student Notification Modal.
 * Allows coordinators & super admins to upload a shortlisted candidates PDF,
 * match students against the database, configure the target round/interview name,
 * and dispatch in-app notifications directly to students inside the portal.
 *
 * @module components/drives/ShortlistModal
 */

import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Users,
  Bell,
  FileText,
  Award,
} from 'lucide-react';
import {
  parseShortlistPdf,
  notifyShortlistedStudents,
  type DriveItem,
  type MatchedShortlistStudent,
} from '@/services/drives.service';

interface ShortlistModalProps {
  drive: DriveItem;
  onClose: () => void;
  onCompleted: () => void;
}

export function ShortlistModal({ drive, onClose, onCompleted }: ShortlistModalProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [matched, setMatched] = useState<MatchedShortlistStudent[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [hasParsed, setHasParsed] = useState(false);

  const [roundNumber, setRoundNumber] = useState<number>(2);
  const [roundName, setRoundName] = useState<string>('Round 2 - Technical Interview');
  const [markAsPlaced, setMarkAsPlaced] = useState<boolean>(false);

  const [isNotifying, setIsNotifying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile && !rawText.trim()) {
      setFeedback({ type: 'error', text: 'Please upload a Shortlist PDF or paste candidate names/roll numbers.' });
      return;
    }

    setIsParsing(true);
    setFeedback(null);
    try {
      const res = await parseShortlistPdf(drive.id, {
        file: pdfFile || undefined,
        rawText: rawText.trim() || undefined,
      });
      setMatched(res.matchedStudents);
      setSelectedUserIds(new Set(res.matchedStudents.map((s) => s.userId)));
      setHasParsed(true);
      if (res.matchedStudents.length === 0) {
        setFeedback({
          type: 'error',
          text: 'No matching students were found in the database from this PDF. Try pasting their Roll Numbers or Full Names below.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.error?.message || err?.message || 'Failed to parse shortlist PDF.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const toggleStudent = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleNotify = async () => {
    if (selectedUserIds.size === 0) {
      setFeedback({ type: 'error', text: 'Please select at least one matched student.' });
      return;
    }

    setIsNotifying(true);
    setFeedback(null);
    try {
      const res = await notifyShortlistedStudents(drive.id, {
        studentUserIds: Array.from(selectedUserIds),
        roundNumber,
        roundName: roundName.trim() || `Round ${roundNumber}`,
        markAsPlaced,
      });
      setFeedback({ type: 'success', text: res.message });
      onCompleted();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.error?.message || err?.message || 'Failed to notify shortlisted students.',
      });
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#121214] border border-neutral-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white text-black">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Shortlist PDF &amp; Round Notification — {drive.company}
              </h3>
              <p className="text-xs text-neutral-400">
                Upload shortlisted candidate PDF to match students in the database and notify them in the portal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                : 'bg-red-950/60 border-red-800/70 text-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Step 1: Upload PDF / Paste Text */}
        <form onSubmit={handleParse} className="space-y-3 text-xs">
          <div className="border-2 border-dashed border-neutral-700 rounded-2xl p-4 bg-neutral-900/50 text-center space-y-2">
            <input
              type="file"
              accept=".pdf,application/pdf"
              id="shortlist-pdf-input"
              className="hidden"
              onChange={(e) => {
                setPdfFile(e.target.files?.[0] || null);
                setFeedback(null);
              }}
            />
            <label htmlFor="shortlist-pdf-input" className="cursor-pointer flex flex-col items-center gap-1.5">
              <UploadCloud className="h-6 w-6 text-neutral-300" />
              <span className="font-bold text-white">
                {pdfFile ? pdfFile.name : 'Click to upload Shortlisted Candidates PDF (.pdf)'}
              </span>
              <span className="text-[11px] text-neutral-400">
                Extracts Roll Numbers, Registration Numbers, Emails, and Student Names automatically
              </span>
            </label>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Or Paste Shortlisted Names / Roll Numbers (Optional)
            </label>
            <textarea
              rows={2}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. 2022BCSE001, Aashin Mohammed A Z, Priya Nair..."
              className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-neutral-500 focus:border-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isParsing}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 transition flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            <span>{isParsing ? 'Scanning PDF & Matching Database...' : 'Scan PDF & Match Students'}</span>
          </button>
        </form>

        {/* Step 2: Matched Students + Round Configuration */}
        {hasParsed && matched.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span>Matched Students in Database ({selectedUserIds.size} / {matched.length} selected)</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  setSelectedUserIds(
                    selectedUserIds.size === matched.length
                      ? new Set()
                      : new Set(matched.map((m) => m.userId))
                  )
                }
                className="text-[11px] font-semibold text-neutral-300 hover:text-white underline"
              >
                {selectedUserIds.size === matched.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-800 bg-[#0c0c0e] divide-y divide-neutral-800/70">
              {matched.map((s) => {
                const isChecked = selectedUserIds.has(s.userId);
                return (
                  <label
                    key={s.userId}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-neutral-900/60 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStudent(s.userId)}
                        className="rounded border-neutral-700 bg-neutral-900 text-white h-4 w-4"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{s.name}</span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {s.studentId} &bull; {s.branch}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950/70 text-emerald-300 border border-emerald-800/70">
                      Matched by {s.matchSource}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Round / Interview Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Round Number
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={roundNumber}
                  onChange={(e) => {
                    const n = Number(e.target.value) || 1;
                    setRoundNumber(n);
                    setRoundName(`Round ${n} - Interview`);
                  }}
                  className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-white focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-neutral-300 font-semibold mb-1">
                  Round / Interview Stage Name
                </label>
                <input
                  type="text"
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="e.g. Round 2 - Technical Interview, HR Round, Final Offer"
                  className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={markAsPlaced}
                onChange={(e) => setMarkAsPlaced(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 h-4 w-4"
              />
              <div>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mark as Selected / Placed in this Drive</span>
                </span>
                <span className="text-[11px] text-neutral-400 block">
                  Adds their names directly to the drive&apos;s Selected / Placed Candidates section &amp; updates their placement status.
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleNotify}
              disabled={isNotifying || selectedUserIds.size === 0}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 disabled:bg-neutral-800 disabled:text-neutral-500 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Bell className="h-4 w-4" />
              <span>
                {isNotifying
                  ? 'Sending Portal Notifications...'
                  : `Shortlist & Notify ${selectedUserIds.size} Student(s) for ${roundName || `Round ${roundNumber}`}`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
