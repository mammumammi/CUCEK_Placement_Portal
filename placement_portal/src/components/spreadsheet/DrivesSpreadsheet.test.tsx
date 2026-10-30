import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { DrivesSpreadsheet } from './DrivesSpreadsheet';
import { spreadsheetService } from '@/services/spreadsheet.service';
import type { SpreadsheetRow } from '@/services/spreadsheet.service';

vi.mock('@/services/spreadsheet.service', () => ({
  spreadsheetService: {
    getRows: vi.fn(),
    applyToDrive: vi.fn(),
    saveRowUpdate: vi.fn(),
  },
  saveRowUpdate: vi.fn(),
  getRows: vi.fn(),
  applyToDrive: vi.fn(),
}));

describe('DrivesSpreadsheet Container', () => {
  const mockRow: SpreadsheetRow = {
    applicationId: 'app-1',
    driveId: 'drive-100',
    studentUserId: 'usr-1',
    studentId: '2022BCSE001',
    name: 'Alice Smith',
    branch: 'CSE',
    batch: '2026',
    email: 'alice@college.edu',
    phone: '9876543210',
    activeBacklogs: 0,
    cgpa: 8.75,
    resumeUrl: null,
    extraData: {},
    verified: false,
    verifiedBy: null,
    placed: false,
    appliedAt: '2026-01-01T00:00:00Z',
    permissions: {
      canEditExtraData: true,
      canVerify: false,
      locked: false,
      reason: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads rows and shows DeadlineBanner above the grid when deadline is past', async () => {
    vi.mocked(spreadsheetService.getRows).mockResolvedValueOnce([mockRow]);

    render(
      <DrivesSpreadsheet
        driveId="drive-100"
        deadline="2020-01-01T00:00:00Z"
      />
    );

    // Shows DeadlineBanner
    expect(screen.getByRole('alert')).toHaveTextContent(/deadline has passed/i);

    // Shows loading indicator initially
    expect(screen.getByRole('status')).toBeInTheDocument();

    // After loading resolves, shows the grid with row data
    await waitFor(() => {
      expect(screen.getByDisplayValue('2022BCSE001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument();
    });

    expect(spreadsheetService.getRows).toHaveBeenCalledWith('drive-100');
  });

  it('renders grid without banner when deadline is in the future', async () => {
    vi.mocked(spreadsheetService.getRows).mockResolvedValueOnce([mockRow]);

    render(
      <DrivesSpreadsheet
        driveId="drive-100"
        deadline="2999-01-01T00:00:00Z"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('2022BCSE001')).toBeInTheDocument();
    });

    expect(screen.queryByText(/deadline has passed/i)).not.toBeInTheDocument();
  });

  it('displays error message if getRows fails', async () => {
    vi.mocked(spreadsheetService.getRows).mockRejectedValueOnce(
      new Error('Failed to fetch spreadsheet data')
    );

    render(
      <DrivesSpreadsheet
        driveId="drive-100"
        deadline="2999-01-01T00:00:00Z"
      />
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Failed to fetch spreadsheet data');
    });
  });
});

