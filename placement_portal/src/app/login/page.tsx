'use client';

/**
 * @fileoverview Modern 2026 Black & White Login Page with GSAP animation.
 * Features responsive login form, role-based redirect, and quick credentials reference for Batch 2026 & Batch 2028.
 * @module app/login/page
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import type { UserRole } from '@/core/types/roles';

/**
 * Maps user roles to designated landing page routes post-login.
 */
const ROLE_REDIRECT_ROUTES: Record<UserRole, string> = {
  MAIN_COORDINATOR: '/admin',
  BRANCH_COORDINATOR: '/coordinator',
  STUDENT: '/student',
};

export default function LoginPage() {
  const router = useRouter();
  const { login, loading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(username, password);
      const destination = ROLE_REDIRECT_ROUTES[user.role] || '/student';
      router.push(destination);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      const message =
        axiosError.response?.data?.error?.message ||
        axiosError.message ||
        'Invalid username or password';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-[#f4f4f5] px-4 sm:px-6 lg:px-8 relative selection:bg-white selection:text-black">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-radial from-neutral-800/20 via-transparent to-transparent pointer-events-none" />

      <div
        ref={cardRef}
        className="max-w-md w-full space-y-6 bg-[#101012] p-8 sm:p-10 rounded-3xl border border-neutral-800 shadow-2xl relative z-10"
      >
        {/* Top Back Link & Badge */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-mono font-bold text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Auth OS 2026
          </span>
        </div>

        {/* Title */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-black border border-neutral-800 mx-auto flex items-center justify-center text-white">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            CUCEK Placement Portal
          </h2>
          <p className="text-xs text-neutral-400">
            Cochin University College of Engineering Kuttanad &bull; Sign in with your university credentials
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-950/40 p-3.5 border border-red-800/60 text-xs text-red-300 font-medium"
          >
            {error}
          </div>
        )}

        <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-neutral-300 mb-1"
              >
                Username or Roll Number
              </label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. 2022BCSE001 or admin_2028"
                  className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white transition disabled:opacity-50 font-medium"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-neutral-300 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••••••"
                  className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white transition disabled:opacity-50 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full text-xs font-bold text-black bg-white hover:bg-neutral-200 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Credentials Guide for All Login Portals */}
        <div className="p-4 rounded-2xl bg-[#141417] border border-neutral-800 text-[11px] text-neutral-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white block">Quick Testing Portals:</span>
            <span className="text-[10px] text-neutral-500">Click to autofill</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('admin123');
              }}
              className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition"
            >
              <span className="text-neutral-500 block">Main Admin (2026):</span>
              <span className="text-white font-bold">admin</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('admin_2028');
                setPassword('admin_2028');
              }}
              className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition"
            >
              <span className="text-neutral-500 block">Super Admin (2028):</span>
              <span className="text-white font-bold">admin_2028</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('cse_dept');
                setPassword('dept123');
              }}
              className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition"
            >
              <span className="text-neutral-500 block">Dept Teacher (CSE):</span>
              <span className="text-white font-bold">cse_dept</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('cse_junior_2028');
                setPassword('cse_junior_2028');
              }}
              className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition"
            >
              <span className="text-neutral-500 block">Junior Coord (2028):</span>
              <span className="text-white font-bold">cse_junior_2028</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('2022BCSE001');
                setPassword('2022BCSE001');
              }}
              className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-left transition col-span-2"
            >
              <span className="text-neutral-500 block">Student Demo (Batch 2026):</span>
              <span className="text-white font-bold">2022BCSE001</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
