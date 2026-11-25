import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { PlacedStudentsManager } from './PlacedStudentsManager';
import * as profilesService from '@/services/profiles.service';

vi.mock('@/services/profiles.service', () => ({
  listPlacedStudents: vi.fn(),
  listProfiles: vi.fn().mockResolvedValue([]),
  recordPlacedStudentManual: vi.fn(),
  previewPlacedStudentsExcel: vi.fn(),
  commitPlacedStudentsBatch: vi.fn(),
  unmarkPlacedStudent: vi.fn(),
}));

describe('PlacedStudentsManager', () => {
  const mockPlacedStudents: profilesService.PlacedStudentRecord[] = [
    {
      applicationId: 'app-1',
      driveId: 'drive-1',
      studentUserId: 'usr-1',
      studentId: '2022BCSE001',
      name: 'Aditya V',
      branch: 'CSE',
      batch: '2026',
      cgpa: 9.2,
      company: 'Google',
      role: 'Software Development Engineer',
      ctcLpa: 28.5,
      packageCategory: 'DREAM',
      placedAt: '2026-11-20T10:00:00Z',
    },
    {
      applicationId: 'app-2',
      driveId: 'drive-2',
      studentUserId: 'usr-2',
      studentId: '2022BECE005',
      name: 'Priya Nair',
      branch: 'ECE',
      batch: '2026',
      cgpa: 8.1,
      company: 'TCS',
      role: 'Digital Trainee',
      ctcLpa: 7.0,
      packageCategory: 'GENERAL',
      placedAt: '2026-11-21T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profilesService.listPlacedStudents).mockResolvedValue(mockPlacedStudents);
  });

  it('renders placed students roster with KPI cards', async () => {
    render(<PlacedStudentsManager userRole="MAIN_COORDINATOR" />);

    await waitFor(() => {
      expect(screen.getByText('Placed Students Roster & Data Entry')).toBeDefined();
    });

    // Check KPIs
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // Total placed / Row index
    expect(screen.getByText('28.5')).toBeDefined(); // Highest package
    expect(screen.getByText('17.75')).toBeDefined(); // Average package: (28.5 + 7.0)/2

    // Check candidate rows
    expect(screen.getByText('2022BCSE001')).toBeDefined();
    expect(screen.getByText('Aditya V')).toBeDefined();
    expect(screen.getByText('Google')).toBeDefined();
    expect(screen.getByText('28.5 LPA')).toBeDefined();

    expect(screen.getByText('2022BECE005')).toBeDefined();
    expect(screen.getByText('Priya Nair')).toBeDefined();
    expect(screen.getByText('TCS')).toBeDefined();
    expect(screen.getByText('7 LPA')).toBeDefined();
  });

  it('filters students by search query', async () => {
    render(<PlacedStudentsManager userRole="MAIN_COORDINATOR" />);

    await waitFor(() => {
      expect(screen.getByText('Google')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/search student/i);
    fireEvent.change(searchInput, { target: { value: 'Google' } });

    expect(screen.getByText('2022BCSE001')).toBeDefined();
    expect(screen.queryByText('2022BECE005')).toBeNull();
  });

  it('opens and submits manual placement entry modal', async () => {
    vi.mocked(profilesService.recordPlacedStudentManual).mockResolvedValue({
      success: true,
      message: 'Placement recorded successfully!',
      studentId: '2022BCSE099',
      company: 'Microsoft',
    });

    render(<PlacedStudentsManager userRole="MAIN_COORDINATOR" />);

    await waitFor(() => {
      expect(screen.getByText('Add Placed Student')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add Placed Student'));

    // Modal should now be open
    expect(screen.getByText('Record Placed Student')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2022BCSE001/i), {
      target: { value: '2022BCSE099' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Google, Microsoft/i), {
      target: { value: 'Microsoft' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Software Engineer/i), {
      target: { value: 'SDE-1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 14\.5/i), {
      target: { value: '22.0' },
    });

    const submitBtn = screen.getByRole('button', { name: /^Record Placement$/i });
    const form = submitBtn.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.click(submitBtn);
    }

    await waitFor(() => {
      expect(profilesService.recordPlacedStudentManual).toHaveBeenCalledWith({
        studentId: '2022BCSE099',
        company: 'Microsoft',
        role: 'SDE-1',
        ctcLpa: 22.0,
        packageCategory: 'GENERAL',
      });
    });
  });

  it('opens batch excel upload modal and shows validation preview', async () => {
    vi.mocked(profilesService.previewPlacedStudentsExcel).mockResolvedValue({
      totalRows: 2,
      validCount: 2,
      invalidCount: 0,
      rows: [
        {
          rowNumber: 2,
          studentId: '2022BCSE010',
          name: 'Rahul K',
          branch: 'CSE',
          cgpa: 8.5,
          company: 'Amazon',
          role: 'SDE',
          ctcLpa: 24.0,
          packageCategory: 'DREAM',
          valid: true,
        },
      ],
    });

    vi.mocked(profilesService.commitPlacedStudentsBatch).mockResolvedValue({
      success: true,
      committedCount: 1,
      message: 'Committed 1 record',
    });

    render(<PlacedStudentsManager userRole="MAIN_COORDINATOR" />);

    await waitFor(() => {
      expect(screen.getByText('Batch Excel Upload')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Batch Excel Upload'));

    expect(screen.getByText('Batch Placed Students Upload (.xlsx)')).toBeDefined();

    // Trigger file input
    const file = new File(['dummy'], 'sample.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    await waitFor(() => {
      expect(profilesService.previewPlacedStudentsExcel).toHaveBeenCalled();
      expect(screen.getByText('Rahul K')).toBeDefined();
      expect(screen.getByText('Amazon')).toBeDefined();
    });

    // Commit placements
    const commitButton = screen.getByRole('button', { name: /Commit Valid Placements/i });
    fireEvent.click(commitButton);

    await waitFor(() => {
      expect(profilesService.commitPlacedStudentsBatch).toHaveBeenCalled();
    });
  });

  it('confirms and unmarks a placed student', async () => {
    vi.mocked(profilesService.unmarkPlacedStudent).mockResolvedValue({
      success: true,
      message: 'Removed placement status',
    });

    render(<PlacedStudentsManager userRole="MAIN_COORDINATOR" />);

    await waitFor(() => {
      expect(screen.getAllByText('Unmark').length).toBeGreaterThan(0);
    });

    // Click unmark on first candidate
    fireEvent.click(screen.getAllByText('Unmark')[0]);

    // Modal confirmation opens
    expect(screen.getByText('Unmark Placement Status')).toBeDefined();
    expect(screen.getByText(/Are you sure you want to remove placement status/i)).toBeDefined();

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /Yes, Unmark/i }));

    await waitFor(() => {
      expect(profilesService.unmarkPlacedStudent).toHaveBeenCalledWith('usr-1', 'drive-1');
    });
  });
});
