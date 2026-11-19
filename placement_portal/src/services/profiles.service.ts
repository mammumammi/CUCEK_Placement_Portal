/**
 * @fileoverview Frontend service for student profiles and correction requests.
 * @module services/profiles.service
 */

import { apiClient } from '@/lib/api-client';

export interface SemesterDetail {
  id?: string;
  semester: number;
  credits: number;
  sgpa: number;
  percentage?: number | null;
  totalMarks?: number | null;
  maxMarks?: number | null;
  marksheetUrl?: string | null;
}

export interface StudentProfileData {
  userId: string;
  studentId: string;
  registrationNumber?: string | null;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  age?: number | null;
  branch: string | null;
  batch: string | null;
  email: string | null;
  phone: string | null;
  activeBacklogs: number;
  cgpa: number;
  percentage?: number | null;
  totalMarks?: number | null;
  maxMarks?: number | null;
  marksheetUrl?: string | null;
  s1MarksheetUrl?: string | null;
  s2MarksheetUrl?: string | null;
  s3MarksheetUrl?: string | null;
  s4MarksheetUrl?: string | null;
  s5MarksheetUrl?: string | null;
  s6MarksheetUrl?: string | null;
  resumeUrl?: string | null;
  isProfileComplete?: boolean;
  semesters?: SemesterDetail[];
  placement?: {
    isPlaced: boolean;
    company: string | null;
    role: string | null;
    ctcLpa: number | null;
    placedAt?: string | null;
  };
}

export interface CompleteProfilePayload {
  registrationNumber?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  branch?: string;
  batch?: string;
  email?: string;
  phone?: string;
  marksheetUrl?: string | null;
  resumeUrl?: string | null;
}

export interface CorrectionRequestData {
  id: string;
  studentUserId: string;
  studentId: string;
  registrationNumber?: string | null;
  studentName: string | null;
  branch: string;
  requestedChanges: Record<string, unknown>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewerRemarks?: string | null;
  createdAt: string | number;
  updatedAt: string | number;
}

/**
 * Fetches the currently authenticated student's profile and semester breakdown.
 */
export async function getMyProfile(): Promise<StudentProfileData> {
  const response = await apiClient.get<StudentProfileData>('/profiles/me');
  return response.data;
}

/**
 * Completes or updates the authenticated student's profile (missing fields on first login).
 */
export async function completeMyProfile(payload: CompleteProfilePayload): Promise<StudentProfileData> {
  const response = await apiClient.patch<StudentProfileData>('/profiles/me', payload);
  return response.data;
}

/**
 * Lists student profiles with optional branch filtering (coordinators only).
 */
export async function listProfiles(branch?: string): Promise<StudentProfileData[]> {
  const response = await apiClient.get<StudentProfileData[]>('/profiles', {
    params: branch ? { branch } : undefined,
  });
  return response.data;
}

/**
 * Fetches a single student profile by Student ID / Reg No.
 */
export async function getProfileByStudentId(studentId: string): Promise<StudentProfileData> {
  const response = await apiClient.get<StudentProfileData>(`/profiles/${studentId}`);
  return response.data;
}

/**
 * Submits a data correction request from a student to be reviewed by their coordinator.
 */
export async function createCorrectionRequest(payload: {
  requestedChanges: Record<string, unknown>;
  reason: string;
}): Promise<CorrectionRequestData> {
  const response = await apiClient.post<CorrectionRequestData>(
    '/profiles/correction-requests',
    payload
  );
  return response.data;
}

/**
 * Lists correction requests scoped to the user (student's own, or coordinator's branch).
 */
export async function listCorrectionRequests(): Promise<CorrectionRequestData[]> {
  const response = await apiClient.get<CorrectionRequestData[]>(
    '/profiles/correction-requests'
  );
  return response.data;
}

/**
 * Approves or rejects a student's correction request (coordinators only).
 */
export async function reviewCorrectionRequest(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  remarks?: string
): Promise<CorrectionRequestData> {
  const response = await apiClient.patch<CorrectionRequestData>(
    `/profiles/correction-requests/${requestId}/review`,
    { action, remarks }
  );
  return response.data;
}

export interface PlacedStudentSummary {
  studentId: string;
  name: string | null;
  branch?: string;
  company: string;
  role: string | null;
  ctcLpa: number | null;
  placedAt?: string | null;
}

export interface DepartmentStats {
  branch: string | null;
  totalStudents: number;
  placedCount: number;
  unplacedCount: number;
  placementRate: number;
  highestPackage: number;
  averagePackage: number;
  activeDrivesCount: number;
  placedStudents: PlacedStudentSummary[];
}

/**
 * Retrieves department-level placement metrics, total placed count, and placed candidate details.
 */
export async function getDepartmentStats(branch?: string): Promise<DepartmentStats> {
  const response = await apiClient.get<DepartmentStats>('/profiles/stats', {
    params: branch ? { branch } : undefined,
  });
  return response.data;
}

