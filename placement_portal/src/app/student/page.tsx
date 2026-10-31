'use client';

/**
 * @fileoverview Student Portal Dashboard.
 * @module app/student/page
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';

export default function StudentPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <RequireAuth roles={['STUDENT']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Placement Portal
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Student Dashboard
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{user?.username}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
              >
                <LogOut className="h-3.5 w-3.5 text-gray-500" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              Welcome, Student {user?.username} ({user?.branch || 'General'})
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your profile is active. You can browse eligible recruitment drives and track your applications.
            </p>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
