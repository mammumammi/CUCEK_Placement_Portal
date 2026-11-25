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
  s7MarksheetUrl?: string | null;
  s8MarksheetUrl?: string | null;
  currentSemester?: number;
  placementStatus?: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  additionalDetails?: Record<string, unknown>;
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

export interface SetBatchCurrentSemesterPayload {
  branch?: string;
  batch?: string;
  currentSemester: number;
}

export interface SetBatchCurrentSemesterResponse {
  updatedCount: number;
  currentSemester: number;
  branch: string | null;
  batch: string;
  message: string;
}

/**
 * Updates the current reached semester for a batch of students (e.g. junior batches).
 */
export async function updateBatchCurrentSemester(
  payload: SetBatchCurrentSemesterPayload
): Promise<SetBatchCurrentSemesterResponse> {
  const response = await apiClient.patch<SetBatchCurrentSemesterResponse>(
    '/profiles/batch-current-semester',
    payload
  );
  return response.data;
}

export interface PlacedStudentRecord {
  applicationId: string;
  driveId: string;
  studentUserId: string;
  studentId: string;
  name: string | null;
  branch: string | null;
  batch: string | null;
  cgpa: number;
  company: string;
  role: string | null;
  ctcLpa: number | null;
  packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  placedAt: string | number;
}

export interface RecordPlacedStudentPayload {
  studentId: string;
  company: string;
  role?: string;
  ctcLpa?: number | null;
  packageCategory?: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  driveId?: string | null;
}

export interface BatchPreviewPlacedRow {
  rowNumber: number;
  studentId: string;
  name?: string;
  branch?: string;
  cgpa?: number;
  company: string;
  role?: string;
  ctcLpa?: number | null;
  packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  valid: boolean;
  error?: string;
}

export interface BatchPreviewPlacedResponse {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: BatchPreviewPlacedRow[];
}

/**
 * Retrieves all currently placed students across departments (or scoped to branch).
 */
export async function listPlacedStudents(branch?: string): Promise<PlacedStudentRecord[]> {
  const response = await apiClient.get<PlacedStudentRecord[]>('/profiles/placed-students', {
    params: branch ? { branch } : undefined,
  });
  return response.data;
}

/**
 * Manually marks a student as placed with company, role, package, and category.
 */
export async function recordPlacedStudentManual(
  payload: RecordPlacedStudentPayload
): Promise<{ success: boolean; message: string; studentId: string; company: string }> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    studentId: string;
    company: string;
  }>('/profiles/placed-students/manual', payload);
  return response.data;
}

/**
 * Uploads an Excel sheet of placed students to validate and preview rows before commit.
 */
export async function previewPlacedStudentsExcel(file: File): Promise<BatchPreviewPlacedResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<BatchPreviewPlacedResponse>(
    '/profiles/placed-students/batch-preview',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Atomically commits a batch of validated student placements.
 */
export async function commitPlacedStudentsBatch(
  records: RecordPlacedStudentPayload[]
): Promise<{ success: boolean; committedCount: number; message: string }> {
  const response = await apiClient.post<{
    success: boolean;
    committedCount: number;
    message: string;
  }>('/profiles/placed-students/batch-commit', { records });
  return response.data;
}

/**
 * Unmarks a student as placed.
 */
export async function unmarkPlacedStudent(
  studentUserId: string,
  driveId: string
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/profiles/placed-students/${studentUserId}/${driveId}`
  );
  return response.data;
}

/**
 * Updates a student's placement status (UNPLACED | GENERAL | DREAM | INTERNSHIP).
 */
export async function updateStudentPlacementStatus(
  studentId: string,
  placementStatus: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP'
): Promise<{ success: boolean; studentId: string; placementStatus: string; message: string }> {
  const response = await apiClient.patch<{
    success: boolean;
    studentId: string;
    placementStatus: string;
    message: string;
  }>(`/profiles/${studentId}/placement-status`, { placementStatus });
  return response.data;
}

/**
 * Permanently deletes a student record and their associated account.
 */
export async function deleteStudent(
  studentId: string
): Promise<{ success: boolean; deletedStudentId: string; name?: string; message: string }> {
  const response = await apiClient.delete<{
    success: boolean;
    deletedStudentId: string;
    name?: string;
    message: string;
  }>(`/profiles/${studentId}`);
  return response.data;
}

/**
 * Deletes a batch of students filtered by branch, batch, or creation timestamp.
 */
export async function deleteBatchStudents(filter?: {
  branch?: string;
  batch?: string;
  createdAt?: number;
}): Promise<{ success: boolean; deletedCount: number; message: string }> {
  const params = new URLSearchParams();
  if (filter?.branch) params.set('branch', filter.branch);
  if (filter?.batch) params.set('batch', filter.batch);
  if (filter?.createdAt) params.set('createdAt', String(filter.createdAt));

  const response = await apiClient.delete<{
    success: boolean;
    deletedCount: number;
    message: string;
  }>(`/profiles/batch-delete?${params.toString()}`);
  return response.data;
}

export interface StudentNotificationItem {
  id: string;
  studentUserId: string;
  driveId: string | null;
  title: string;
  message: string;
  roundLabel: string | null;
  read: boolean;
  createdAt: string | number;
}

/**
 * Fetches in-app shortlist & round notifications for the currently logged-in student.
 */
export async function listMyNotifications(): Promise<StudentNotificationItem[]> {
  const response = await apiClient.get<StudentNotificationItem[]>('/profiles/me/notifications');
  return response.data;
}

/**
 * Marks a student notification as read.
 */
export async function markMyNotificationRead(notificationId: string): Promise<{ success: boolean }> {
  const response = await apiClient.patch<{ success: boolean }>(
    `/profiles/me/notifications/${notificationId}/read`
  );
  return response.data;
}

