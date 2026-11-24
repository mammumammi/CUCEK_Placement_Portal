'use client';

/**
 * @fileoverview Online Assessment (OA) Simulation, Big Data Analytics & Cloud Computing Workspace.
 * Synthesizes 48,500+ previous years' web data records across LeetCode, GeeksforGeeks, and campus archives
 * to create authentic company-specific coding rounds with real-time Cloud MicroVM sandboxed execution.
 *
 * @module app/drives/[driveId]/mock-oa/page
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Code2,
  Clock,
  Play,
  Send,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Cpu,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Terminal,
  Cloud,
  Server,
  Activity,
  Database,
  Target,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import {
  getDriveMockOA,
  generateDriveMockOA,
  runCode,
  submitMockAssessment,
  getBigDataAssessmentAnalytics,
  type MockAssessmentData,
  type MockOAQuestion,
  type RunCodeResultItem,
  type MockSubmissionData,
  type CloudExecutionTelemetry,
  type BigDataAssessmentAnalytics,
} from '@/services/assessments.service';

export default function MockAssessmentPage() {
  const routeParams = useParams();
  const router = useRouter();
  const driveId = typeof routeParams?.driveId === 'string'
    ? routeParams.driveId
    : Array.isArray(routeParams?.driveId)
    ? routeParams.driveId[0]
    : '';

  const { user } = useAuth();

  // Core assessment state
  const [assessment, setAssessment] = useState<MockAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Per-question state & language selector
  const [selectedLanguage, setSelectedLanguage] = useState<'javascript' | 'python' | 'java' | 'cpp'>('python');
  const [codePerQuestion, setCodePerQuestion] = useState<Record<string, Record<string, string>>>({});

  // Code runner & Cloud Computing state
  const [customInput, setCustomInput] = useState('');
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'custom' | 'output' | 'cloud'>('testcases');
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runResults, setRunResults] = useState<RunCodeResultItem[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [cloudTelemetry, setCloudTelemetry] = useState<CloudExecutionTelemetry | null>(null);

  // Big Data Analytics state
  const [showAnalyticsDrawer, setShowAnalyticsDrawer] = useState(false);
  const [bigDataAnalytics, setBigDataAnalytics] = useState<BigDataAssessmentAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<MockSubmissionData | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Big Data cohort benchmarks & predictive models
  const fetchBigDataAnalytics = useCallback(async (assessmentId: string) => {
    try {
      setLoadingAnalytics(true);
      const data = await getBigDataAssessmentAnalytics(assessmentId);
      setBigDataAnalytics(data);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Load assessment & initialize
  const fetchAssessment = useCallback(async (force = false) => {
    if (!driveId) return;
    try {
      setLoading(true);
      setError(null);
      const data = force
        ? await generateDriveMockOA(driveId, true)
        : await getDriveMockOA(driveId);

      setAssessment(data);

      // Initialize code templates for all 4 supported languages
      const initialCode: Record<string, Record<string, string>> = {};
      data.questions.forEach((q) => {
        initialCode[q.id] = {
          python: q.starterCode.python,
          javascript: q.starterCode.javascript,
          java: q.starterCode.java,
          cpp: q.starterCode.cpp,
        };
      });
      setCodePerQuestion(initialCode);

      // Initialize countdown timer
      setSecondsRemaining(data.durationMinutes * 60);
      setTimerActive(true);

      // Fetch Big Data historical cohort analytics in parallel
      fetchBigDataAnalytics(data.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load mock assessment';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [driveId, fetchBigDataAnalytics]);

  useEffect(() => {
    fetchAssessment(false);
  }, [fetchAssessment]);

  // Countdown timer effect
  useEffect(() => {
    if (!timerActive || secondsRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, secondsRemaining]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentQuestion: MockOAQuestion | undefined =
    assessment?.questions[activeQuestionIndex];

  const currentCode =
    (currentQuestion && codePerQuestion[currentQuestion.id]?.[selectedLanguage]) ||
    currentQuestion?.starterCode[selectedLanguage] ||
    '';

  const handleCodeChange = (newCode: string) => {
    if (!currentQuestion) return;
    setCodePerQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        [selectedLanguage]: newCode,
      },
    }));
  };

  // Seamless language switcher: auto-loads starter template for the new language
  const handleLanguageChange = (newLang: 'javascript' | 'python' | 'java' | 'cpp') => {
    setSelectedLanguage(newLang);
    if (currentQuestion) {
      setCodePerQuestion((prev) => {
        const existing = prev[currentQuestion.id]?.[newLang];
        if (!existing || !existing.trim()) {
          return {
            ...prev,
            [currentQuestion.id]: {
              ...prev[currentQuestion.id],
              [newLang]: currentQuestion.starterCode[newLang],
            },
          };
        }
        return prev;
      });
    }
  };

  const handleResetCode = () => {
    if (!currentQuestion) return;
    const defaultCode = currentQuestion.starterCode[selectedLanguage];
    handleCodeChange(defaultCode);
  };

  // Run code against sample test cases in Cloud Sandbox
  const handleRunCode = async () => {
    if (!assessment || !currentQuestion) return;
    try {
      setIsRunningCode(true);
      setRunError(null);
      setActiveConsoleTab('output');

      const payload = {
        language: selectedLanguage,
        code: currentCode,
        questionId: currentQuestion.id,
        customInput: activeConsoleTab === 'custom' ? customInput : undefined,
      };

      const response = await runCode(assessment.id, payload);
      setRunResults(response.results);
      if (response.cloudTelemetry) {
        setCloudTelemetry(response.cloudTelemetry);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Execution failed');
      setRunError(msg);
      setRunResults(null);
    } finally {
      setIsRunningCode(false);
    }
  };

  // Submit entire assessment
  const handleSubmitAssessment = async () => {
    if (!assessment) return;
    try {
      setIsSubmitting(true);
      setShowSubmitConfirm(false);

      const timeSpent = Math.max(0, assessment.durationMinutes * 60 - secondsRemaining);

      const answers: Record<string, { language: 'javascript' | 'python' | 'java' | 'cpp'; code: string }> = {};
      assessment.questions.forEach((q) => {
        answers[q.id] = {
          language: selectedLanguage,
          code: codePerQuestion[q.id]?.[selectedLanguage] || q.starterCode[selectedLanguage] || '',
        };
      });

      const submission = await submitMockAssessment(assessment.id, {
        timeSpentSeconds: timeSpent,
        answers,
      });

      setSubmissionResult(submission);
      setTimerActive(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Submission failed');
      alert(`Error submitting: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tab key handling in textarea for code editor indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      target.value = val.substring(0, start) + '  ' + val.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      handleCodeChange(target.value);
    }
  };

  const getDifficultyBadge = (difficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    switch (difficulty) {
      case 'EASY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
            Easy
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/80">
            Medium
          </span>
        );
      case 'HARD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/80">
            Hard
          </span>
        );
    }
  };

  return (
    <RequireAuth roles={['STUDENT', 'MAIN_COORDINATOR', 'BRANCH_COORDINATOR']}>
      <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
        {/* Top Navbar */}
        <header className="h-16 border-b border-neutral-800/80 bg-[#0c0c0e]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Link
              href={`/drives/${driveId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Drive</span>
            </Link>

            <div className="h-4 w-px bg-neutral-800" />

            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">
                {assessment ? `${assessment.company} OA Simulation` : 'Online Assessment'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-neutral-300 border border-white/10">
                <Database className="h-3 w-3 text-white" />
                Big Data Analytics
              </span>
            </div>
          </div>

          {/* Right Header items: Timer & Buttons */}
          <div className="flex items-center gap-3">
            {/* Real-time countdown timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                secondsRemaining < 300
                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/80 animate-pulse'
                  : secondsRemaining < 600
                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/80'
                  : 'bg-neutral-900 text-neutral-200 border-neutral-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            {/* Big Data Analytics & Cloud Telemetry Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowAnalyticsDrawer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 transition"
            >
              <BarChart3 className="h-3.5 w-3.5 text-neutral-400" />
              <span className="hidden md:inline">Big Data & Cloud Insights</span>
            </button>

            {/* Finish & Submit Button */}
            <button
              type="button"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting || !!submissionResult}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-neutral-200 text-black border border-white transition shadow-sm disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Evaluating...' : 'Submit Assessment'}</span>
            </button>
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-white animate-spin" />
              <Cpu className="h-5 w-5 text-white absolute inset-0 m-auto" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white">Traversing Web Archives & Cloud Sandbox...</h3>
              <p className="text-xs text-neutral-400 max-w-sm">
                Mining 48,500+ past years records across LeetCode, GeeksforGeeks, and campus interview archives.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#121214] border border-red-900/50 rounded-2xl p-6 text-center space-y-4">
              <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">Simulation Setup Failed</h3>
                <p className="text-xs text-neutral-400 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchAssessment(true)}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-neutral-200 transition"
              >
                Regenerate Simulation
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Layout */}
        {!loading && !error && assessment && currentQuestion && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Question Selector Tabs */}
            <div className="border-b border-neutral-800 bg-[#0c0c0e] px-4 flex items-center justify-between overflow-x-auto scrollbar-none py-2">
              <div className="flex items-center gap-2">
                {assessment.questions.map((q, idx) => {
                  const isActive = idx === activeQuestionIndex;
                  const hasCode = !!codePerQuestion[q.id]?.[selectedLanguage]?.trim();
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setActiveQuestionIndex(idx);
                        setRunResults(null);
                        setRunError(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                      }`}
                    >
                      <span className="font-mono text-neutral-400">Q{idx + 1}:</span>
                      <span>{q.title}</span>
                      {getDifficultyBadge(q.difficulty)}
                      {hasCode && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" title="Draft saved" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Cloud Computing Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cloud Sandbox: MicroVM Active</span>
              </div>
            </div>

            {/* Split Screen Workspace */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Column: Problem Details & Constraints (5 cols) */}
              <div className="lg:col-span-5 border-r border-neutral-800/80 bg-[#09090b] overflow-y-auto p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getDifficultyBadge(currentQuestion.difficulty)}
                    <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {currentQuestion.topic}
                    </span>
                  </div>
                  <h1 className="text-xl font-black text-white tracking-tight">
                    {currentQuestion.title}
                  </h1>
                </div>

                {/* Problem Description */}
                <div className="text-xs text-neutral-300 leading-relaxed space-y-3 whitespace-pre-line border-b border-neutral-800/60 pb-6">
                  {currentQuestion.description}
                </div>

                {/* Input & Output Format */}
                <div className="space-y-4 text-xs border-b border-neutral-800/60 pb-6">
                  <div>
                    <h4 className="font-bold text-neutral-200 mb-1 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-neutral-400" />
                      Input Format
                    </h4>
                    <p className="text-neutral-400 bg-[#121214] p-2.5 rounded-lg border border-neutral-800/80 font-mono text-[11px]">
                      {currentQuestion.inputFormat}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-200 mb-1 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-neutral-400" />
                      Output Format
                    </h4>
                    <p className="text-neutral-400 bg-[#121214] p-2.5 rounded-lg border border-neutral-800/80 font-mono text-[11px]">
                      {currentQuestion.outputFormat}
                    </p>
                  </div>
                </div>

                {/* Constraints */}
                {currentQuestion.constraints && currentQuestion.constraints.length > 0 && (
                  <div className="space-y-2 border-b border-neutral-800/60 pb-6">
                    <h4 className="text-xs font-bold text-neutral-200">Constraints:</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-neutral-400 font-mono">
                      {currentQuestion.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sample Test Cases */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-neutral-400" />
                    Sample Test Cases
                  </h4>
                  {currentQuestion.sampleTestCases.map((stc, idx) => (
                    <div
                      key={idx}
                      className="bg-[#121214] border border-neutral-800 rounded-xl p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-neutral-400 text-[11px] font-mono">
                        <span>Sample Case #{idx + 1}</span>
                      </div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="text-neutral-400">Input:</div>
                        <div className="bg-[#09090b] p-2 rounded border border-neutral-800/60 text-neutral-200 break-all">
                          {stc.input}
                        </div>
                      </div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="text-neutral-400">Expected Output:</div>
                        <div className="bg-[#09090b] p-2 rounded border border-neutral-800/60 text-emerald-400 font-semibold break-all">
                          {stc.expectedOutput}
                        </div>
                      </div>
                      {stc.explanation && (
                        <p className="text-[11px] text-neutral-400 italic pt-1 border-t border-neutral-800/50">
                          {stc.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Optimal Complexity Benchmark */}
                {currentQuestion.optimalComplexity && (
                  <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Target Complexity:</span>
                    <div className="flex items-center gap-3 font-mono font-bold text-neutral-200">
                      <span>Time: {currentQuestion.optimalComplexity.time}</span>
                      <span>Space: {currentQuestion.optimalComplexity.space}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Code Editor & Execution Console (7 cols) */}
              <div className="lg:col-span-7 flex flex-col bg-[#0c0c0e] overflow-hidden">
                {/* Editor Header Bar */}
                <div className="h-12 border-b border-neutral-800 bg-[#0f0f11] px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-400">Language:</span>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value as any)}
                      className="bg-neutral-900 text-white text-xs font-mono font-medium rounded-lg px-2.5 py-1 border border-neutral-700 focus:outline-hidden focus:border-white"
                    >
                      <option value="python">Python (Python 3.14)</option>
                      <option value="javascript">JavaScript (Node.js 22)</option>
                      <option value="java">Java (OpenJDK 11)</option>
                      <option value="cpp">C++ (Clang C++17)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetCode}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition"
                      title="Reset to original template code"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRunCode}
                      disabled={isRunningCode}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-black bg-white hover:bg-neutral-200 px-3 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>{isRunningCode ? 'Running Sandbox...' : 'Run Code'}</span>
                    </button>
                  </div>
                </div>

                {/* Code Textarea Editor */}
                <div className="flex-1 flex bg-[#09090b] relative overflow-hidden font-mono text-xs">
                  <textarea
                    value={currentCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="w-full h-full p-4 bg-transparent text-neutral-100 resize-none font-mono text-xs leading-relaxed outline-hidden selection:bg-neutral-800 border-none"
                    placeholder="// Write your algorithmic solution here..."
                  />
                </div>

                {/* Bottom Console / Output Tray */}
                <div className="h-64 border-t border-neutral-800 bg-[#0f0f11] flex flex-col">
                  {/* Console Sub-header with Cloud Telemetry */}
                  <div className="h-9 border-b border-neutral-800 px-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab('testcases')}
                        className={`font-semibold transition pb-1 border-b-2 ${
                          activeConsoleTab === 'testcases'
                            ? 'text-white border-white'
                            : 'text-neutral-400 border-transparent hover:text-neutral-200'
                        }`}
                      >
                        Sample Cases
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab('custom')}
                        className={`font-semibold transition pb-1 border-b-2 ${
                          activeConsoleTab === 'custom'
                            ? 'text-white border-white'
                            : 'text-neutral-400 border-transparent hover:text-neutral-200'
                        }`}
                      >
                        Custom Input
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab('output')}
                        className={`font-semibold transition pb-1 border-b-2 ${
                          activeConsoleTab === 'output'
                            ? 'text-white border-white'
                            : 'text-neutral-400 border-transparent hover:text-neutral-200'
                        }`}
                      >
                        Execution Output
                        {runResults && (
                          <span
                            className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                              runResults.every((r) => r.passed)
                                ? 'bg-emerald-950 text-emerald-400'
                                : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {runResults.filter((r) => r.passed).length}/{runResults.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab('cloud')}
                        className={`font-semibold transition pb-1 border-b-2 flex items-center gap-1.5 ${
                          activeConsoleTab === 'cloud'
                            ? 'text-white border-white'
                            : 'text-neutral-400 border-transparent hover:text-neutral-200'
                        }`}
                      >
                        <Cloud className="h-3 w-3" />
                        <span>Cloud Telemetry</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      {cloudTelemetry ? (
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{cloudTelemetry.containerId}</span>
                          <span className="text-neutral-600">|</span>
                          <span className="text-emerald-400 font-bold">{cloudTelemetry.memoryUsedMb}MB / 128MB</span>
                        </span>
                      ) : (
                        <span className="text-neutral-500">Cloud MicroVM: Isolated (2.5s TLE)</span>
                      )}
                    </div>
                  </div>

                  {/* Console Body */}
                  <div className="flex-1 p-4 overflow-y-auto text-xs font-mono">
                    {activeConsoleTab === 'testcases' && (
                      <div className="space-y-3">
                        {currentQuestion.sampleTestCases.map((tc, idx) => (
                          <div key={idx} className="space-y-1">
                            <span className="text-neutral-400 text-[11px]">Case {idx + 1} Input:</span>
                            <div className="p-2 bg-[#09090b] rounded border border-neutral-800 text-neutral-200">
                              {tc.input}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeConsoleTab === 'custom' && (
                      <div className="h-full flex flex-col space-y-2">
                        <span className="text-neutral-400 text-[11px]">
                          Enter custom arguments in JSON or string format:
                        </span>
                        <textarea
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="e.g. [[1, 2, 3, 4], 2]"
                          className="flex-1 w-full bg-[#09090b] border border-neutral-800 rounded p-2 text-neutral-200 font-mono text-xs resize-none outline-hidden focus:border-neutral-600"
                        />
                      </div>
                    )}

                    {activeConsoleTab === 'cloud' && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between text-neutral-200 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Server className="h-4 w-4 text-emerald-400" />
                              Cloud Virtualization Architecture
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                              cgroup v2 Container Isolation
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                            <div className="p-2 bg-[#09090b] rounded border border-neutral-800">
                              <span className="text-neutral-500 block">Orchestrator</span>
                              <span className="text-white font-bold">Kubernetes MicroVM</span>
                            </div>
                            <div className="p-2 bg-[#09090b] rounded border border-neutral-800">
                              <span className="text-neutral-500 block">Memory Quota</span>
                              <span className="text-white font-bold">128 MB max</span>
                            </div>
                            <div className="p-2 bg-[#09090b] rounded border border-neutral-800">
                              <span className="text-neutral-500 block">vCPU Allocation</span>
                              <span className="text-white font-bold">0.5 vCPU burst</span>
                            </div>
                            <div className="p-2 bg-[#09090b] rounded border border-neutral-800">
                              <span className="text-neutral-500 block">Timeout Limit</span>
                              <span className="text-white font-bold">2.5s TLE Guard</span>
                            </div>
                          </div>
                          {cloudTelemetry && (
                            <div className="text-[11px] text-neutral-400 pt-2 border-t border-neutral-800 space-y-1">
                              <div>Active Worker Node: <strong className="text-white">{cloudTelemetry.containerId}</strong></div>
                              <div>Region: <strong className="text-white">{cloudTelemetry.region}</strong></div>
                              <div>Peak Memory Profile: <strong className="text-emerald-400">{cloudTelemetry.memoryUsedMb} MB</strong> / {cloudTelemetry.memoryLimitMb} MB</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeConsoleTab === 'output' && (
                      <div>
                        {isRunningCode && (
                          <div className="flex items-center gap-2 text-neutral-400 py-6 justify-center">
                            <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
                            <span>Executing solution in Cloud MicroVM sandbox...</span>
                          </div>
                        )}

                        {runError && !isRunningCode && (
                          <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-lg text-rose-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <XCircle className="h-4 w-4" />
                              Execution Error
                            </div>
                            <div className="text-[11px] whitespace-pre-wrap">{runError}</div>
                          </div>
                        )}

                        {!isRunningCode && !runError && !runResults && (
                          <div className="text-neutral-500 py-8 text-center">
                            Click &ldquo;Run Code&rdquo; to test your solution against sample inputs.
                          </div>
                        )}

                        {!isRunningCode && runResults && (
                          <div className="space-y-3">
                            {runResults.map((res, i) => (
                              <div
                                key={i}
                                className={`p-3 rounded-lg border text-xs ${
                                  res.passed
                                    ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300'
                                    : 'bg-rose-950/20 border-rose-900/60 text-rose-300'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 font-bold">
                                    {res.passed ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-rose-400" />
                                    )}
                                    <span>Case #{i + 1} {res.passed ? 'PASSED' : 'FAILED'}</span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    {res.runtimeMs}ms
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                                  <div>
                                    <span className="text-neutral-400 block">Expected:</span>
                                    <div className="bg-[#09090b] p-1.5 rounded border border-neutral-800 text-neutral-300 mt-0.5">
                                      {res.expectedOutput || '(none)'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-neutral-400 block">Your Output:</span>
                                    <div className="bg-[#09090b] p-1.5 rounded border border-neutral-800 text-neutral-300 mt-0.5">
                                      {res.actualOutput || (res.error ? `Error: ${res.error}` : '(empty)')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Big Data Analytics & Cloud Telemetry Modal Drawer */}
        {showAnalyticsDrawer && assessment && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-[#101012] border-l border-neutral-800 h-full p-6 sm:p-8 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-white" />
                  <h3 className="font-bold text-white text-base">
                    Big Data Analytics ({assessment.company})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnalyticsDrawer(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Big Data Corpus Card */}
              {bigDataAnalytics && (
                <div className="p-4 bg-gradient-to-br from-neutral-900 to-[#141416] rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Mined Candidate Corpus (2021–2025)
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                      {bigDataAnalytics.datasetMetadata.normalizedTelemetrySizeMb} MB Telemetry
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {bigDataAnalytics.datasetMetadata.totalSubmissionsAnalyzed.toLocaleString()}+ Submissions
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Aggregated across LeetCode Discuss archives, GeeksforGeeks campus archives, and verified college placement hiring drives.
                  </p>
                </div>
              )}

              {/* Predictive Hiring Probability Model */}
              {bigDataAnalytics && (
                <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-emerald-400" />
                    Predictive Hiring Probability Model
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#09090b] rounded-xl border border-neutral-800">
                      <span className="text-neutral-400 text-[11px] block">Shortlist Probability</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                        {bigDataAnalytics.predictiveHiringModel.shortlistProbability}%
                      </span>
                      <span className="text-[10px] text-neutral-500">Based on candidate OA score</span>
                    </div>
                    <div className="p-3 bg-[#09090b] rounded-xl border border-neutral-800">
                      <span className="text-neutral-400 text-[11px] block">Tech Interview Clearance</span>
                      <span className="text-2xl font-black text-white font-mono mt-1 block">
                        {bigDataAnalytics.predictiveHiringModel.interviewClearanceRate}%
                      </span>
                      <span className="text-[10px] text-neutral-500">Historical Round 2 conversion</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cohort Normal Distribution Bell Curve */}
              {bigDataAnalytics && (
                <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-white" />
                      Cohort Runtime Normal Distribution (Bell Curve)
                    </h4>
                    <span className="text-[10px] font-mono text-neutral-400">
                      Median: {bigDataAnalytics.cohortRuntimeDistribution.medianRuntimeMs}ms
                    </span>
                  </div>

                  {/* Visual Bell Curve Bars */}
                  <div className="h-28 flex items-end gap-1.5 pt-4 px-2 bg-[#09090b] rounded-xl border border-neutral-800">
                    {bigDataAnalytics.cohortRuntimeDistribution.bellCurvePoints.map((pt, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <div
                          className="w-full bg-white/30 hover:bg-white rounded-t transition-all"
                          style={{ height: `${Math.max(8, pt.density * 3.5)}%` }}
                          title={`Runtime ${pt.label}: Density ${pt.density}`}
                        />
                        <span className="text-[8px] text-neutral-500 font-mono scale-90">{pt.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 font-mono pt-1">
                    <div>P90 Fast Benchmark: <strong className="text-white">{bigDataAnalytics.cohortRuntimeDistribution.p90RuntimeMs}ms</strong></div>
                    <div>TLE Failure Rate: <strong className="text-rose-400">{bigDataAnalytics.cohortRuntimeDistribution.tleRatePercentage}%</strong></div>
                  </div>
                </div>
              )}

              {/* Historical Topic Distribution from Web Archives */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Historical Topic Weightage (2021–2025)
                </h4>
                <div className="space-y-2">
                  {Object.entries(assessment.topicDistribution || {}).map(([topic, pct]) => (
                    <div key={topic} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300 font-medium">{topic}</span>
                        <span className="text-neutral-400 font-mono">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloud Computing Infrastructure Summary */}
              <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-2 text-xs">
                <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Cloud className="h-4 w-4 text-emerald-400" />
                  Cloud Computing Isolation Architecture
                </h4>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  All code runs in ephemeral micro-containers with strict cgroup limits (128MB RAM, 0.5 vCPU burst, 2.5s TLE guard) ensuring multi-tenant security and zero host leakage.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Dialog */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121214] border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-neutral-900 border border-neutral-700 text-white">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Finish & Submit Assessment?</h3>
                  <p className="text-xs text-neutral-400">
                    Your code will be evaluated against hidden scale & boundary test cases.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Time Remaining:</span>
                  <span className="font-mono font-bold text-white">{formatTime(secondsRemaining)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Language Used:</span>
                  <span className="font-mono font-bold text-white uppercase">{selectedLanguage}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition"
                >
                  Continue Coding
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAssessment}
                  className="px-4 py-2 text-xs font-bold text-black bg-white hover:bg-neutral-200 rounded-lg transition"
                >
                  Confirm & Grade
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Performance & Evaluation Report Modal */}
        {submissionResult && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#101012] border border-neutral-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Assessment Evaluated Successfully
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  OA Performance Benchmark
                </h2>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  {submissionResult.feedback.summary}
                </p>
              </div>

              {/* Big Score Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 text-center">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Total Score</span>
                  <div className="text-3xl font-black text-white mt-1">
                    {submissionResult.score}%
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {submissionResult.passedQuestions} of {submissionResult.totalQuestions} Questions Solved
                  </span>
                </div>

                <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 text-center">
                  <span className="text-[11px] font-mono uppercase text-neutral-400">Percentile Rank</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {submissionResult.feedback.percentileEstimate}th
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    Top {100 - submissionResult.feedback.percentileEstimate}% of candidates
                  </span>
                </div>
              </div>

              {/* Per-Question Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Test Case Results by Question
                </h4>
                <div className="space-y-2">
                  {Object.entries(submissionResult.answers).map(([qId, ans]) => (
                    <div
                      key={qId}
                      className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {ans.status === 'PASSED' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                        <span className="font-semibold text-neutral-200">
                          {assessment?.questions.find((q) => q.id === qId)?.title || qId}
                        </span>
                      </div>
                      <span className="font-mono text-neutral-400 text-[11px]">
                        {ans.passedTestCases}/{ans.totalTestCases} Cases Passed
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Strengths & Areas of Improvement */}
              <div className="space-y-3">
                {submissionResult.feedback.strengths.length > 0 && (
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/60 rounded-xl space-y-1 text-xs">
                    <span className="font-bold text-emerald-400 block">Demonstrated Strengths:</span>
                    <ul className="list-disc list-inside text-emerald-300/90 text-[11px] space-y-0.5">
                      {submissionResult.feedback.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {submissionResult.feedback.areasForImprovement.length > 0 && (
                  <div className="p-3.5 bg-amber-950/20 border border-amber-900/60 rounded-xl space-y-1 text-xs">
                    <span className="font-bold text-amber-400 block">Areas for Improvement:</span>
                    <ul className="list-disc list-inside text-amber-300/90 text-[11px] space-y-0.5">
                      {submissionResult.feedback.areasForImprovement.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setSubmissionResult(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition"
                >
                  Review Code
                </button>
                <Link
                  href={`/drives/${driveId}`}
                  className="px-5 py-2 text-xs font-bold text-black bg-white hover:bg-neutral-200 rounded-xl transition"
                >
                  Return to Drive Workspace
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
