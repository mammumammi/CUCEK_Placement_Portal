import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import type {
  SpreadsheetRow,
  DriveExtraField,
} from '@/services/spreadsheet.service';
import { saveRowUpdate } from '@/services/spreadsheet.service';

vi.mock('@/services/spreadsheet.service', () => ({
  saveRowUpdate: vi.fn(),
  getRows: vi.fn(),
  applyToDrive: vi.fn(),
}));

describe('SpreadsheetGrid Component', () => {
  const extraFields: DriveExtraField[] = [
    {
      key: 'preferredCity',
      label: 'Preferred City',
      type: 'text',
      required: true,
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      type: 'number',
      required: false,
    },
    {
      key: 'workMode',
      label: 'Work Mode',
      type: 'dropdown',
      options: ['Remote', 'Hybrid', 'Onsite'],
      required: true,
    },
  ];

  const createMockRow = (
    overrides?: Partial<SpreadsheetRow>
  ): SpreadsheetRow => ({
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
    extraData: {
      preferredCity: 'Bangalore',
      expectedCtc: 12,
      workMode: 'Hybrid',
    },
    verified: false,
    verifiedBy: null,
    placed: false,
    appliedAt: '2026-01-01T00:00:00Z',
    permissions: {
      canEditExtraData: true,
      canVerify: true,
      locked: false,
      reason: null,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('locked profile columns render disabled', () => {
    const row = createMockRow();
    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    // Profile columns: studentId, name, branch, cgpa
    const studentIdInput = screen.getByDisplayValue('2022BCSE001');
    const nameInput = screen.getByDisplayValue('Alice Smith');
    const branchInput = screen.getByDisplayValue('CSE');
    const cgpaInput = screen.getByDisplayValue('8.75');

    expect(studentIdInput).toBeDisabled();
    expect(nameInput).toBeDisabled();
    expect(branchInput).toBeDisabled();
    expect(cgpaInput).toBeDisabled();
  });

  it('a row with canEditExtraData=false has disabled inputs and no active Save button', () => {
    const row = createMockRow({
      permissions: {
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Deadline passed',
      },
    });

    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    const cityInput = screen.getByPlaceholderText('Preferred City');
    const ctcInput = screen.getByPlaceholderText('Expected CTC');
    const modeSelect = screen.getByLabelText('Work Mode');
    const saveButton = screen.getByRole('button', { name: /save row/i });

    expect(cityInput).toBeDisabled();
    expect(ctcInput).toBeDisabled();
    expect(modeSelect).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });

  it('Save Row calls saveRowUpdate with the right arguments (mock the service)', async () => {
    const row = createMockRow();
    vi.mocked(saveRowUpdate).mockResolvedValueOnce({
      ...row,
      extraData: {
        ...row.extraData,
        preferredCity: 'Hyderabad',
      },
    });

    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    const cityInput = screen.getByPlaceholderText('Preferred City');

    // Initially not edited -> save disabled
    expect(screen.getByRole('button', { name: /save row/i })).toBeDisabled();

    // Edit extra field
    fireEvent.change(cityInput, { target: { value: 'Hyderabad' } });

    // Save button becomes active
    const saveButton = screen.getByRole('button', { name: /save row/i });
    expect(saveButton).toBeEnabled();

    // Click Save Row
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveRowUpdate).toHaveBeenCalledWith('drive-100', '2022BCSE001', {
        extraData: {
          preferredCity: 'Hyderabad',
          expectedCtc: 12,
          workMode: 'Hybrid',
        },
        verified: false,
      });
    });
  });

  it('the Verified checkbox is hidden when canVerify=false', () => {
    const row = createMockRow({
      permissions: {
        canEditExtraData: true,
        canVerify: false,
        locked: false,
        reason: null,
      },
    });

    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    expect(screen.queryByLabelText('Verified')).not.toBeInTheDocument();
  });

  it('the Verified checkbox is visible when canVerify=true', () => {
    const row = createMockRow({
      permissions: {
        canEditExtraData: false,
        canVerify: true,
        locked: false,
        reason: null,
      },
    });

    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    const verifiedCheckbox = screen.getByLabelText('Verified');
    expect(verifiedCheckbox).toBeInTheDocument();
    expect(verifiedCheckbox).not.toBeChecked();

    // Toggle verified
    fireEvent.click(verifiedCheckbox);
    expect(verifiedCheckbox).toBeChecked();

    const saveButton = screen.getByRole('button', { name: /save row/i });
    expect(saveButton).toBeEnabled();
  });

  it('the server error message is displayed', async () => {
    const row = createMockRow();
    vi.mocked(saveRowUpdate).mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Invalid option selected for field Work Mode',
          },
        },
      },
    });

    render(
      <SpreadsheetGrid
        driveId="drive-100"
        rows={[row]}
        extraFields={extraFields}
      />
    );

    const cityInput = screen.getByPlaceholderText('Preferred City');
    fireEvent.change(cityInput, { target: { value: 'Pune' } });

    const saveButton = screen.getByRole('button', { name: /save row/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        'Invalid option selected for field Work Mode'
      );
    });
  });
});
