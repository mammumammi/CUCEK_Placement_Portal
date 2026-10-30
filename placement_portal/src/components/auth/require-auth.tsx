'use client';

/**
 * @fileoverview Route protection wrapper component for client-side navigation.
 *
 * NOTE: Real security enforcement happens on the backend API (HTTP-only session
 * cookies, JWT verification, RBAC middlewares, DB checks). This component provides
 * UX-level protection only to redirect unauthenticated or unauthorized users to the
 * login page before making calls that would fail with 401/403.
 *
 * @module components/auth/require-auth
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { UserRole } from '@/core/types/roles';

export interface RequireAuthProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

/**
 * Client-side route protection guard.
 * Redirects to /login if unauthenticated or if the authenticated user lacks required roles.
 *
 * @param props.children - Child elements to render when authorized.
 * @param props.roles - Optional list of authorized roles. If omitted, any authenticated user is allowed.
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      router.push('/login');
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

export default RequireAuth;

