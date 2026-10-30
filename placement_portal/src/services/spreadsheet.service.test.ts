import { it, expect, vi, describe } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: { patch: vi.fn(), get: vi.fn(), post: vi.fn() },
}));
import { apiClient } from '@/lib/api-client';
import {
  saveRowUpdate,
  getRows,
  applyToDrive,
  spreadsheetService,
} from './spreadsheet.service';

it('sends a PATCH to the row endpoint', async () => {
  (apiClient.patch as any).mockResolvedValue({ data: { ok: true } });
  await saveRowUpdate('d1', 's1', { extraData: { skills: 'React' } });
  expect(apiClient.patch).toHaveBeenCalledWith(
    '/spreadsheet/drives/d1/rows/s1',
    { extraData: { skills: 'React' } }
  );
});

describe('additional spreadsheet service methods', () => {
  it('calls getRows with correct URL', async () => {
    const mockRows = [{ studentId: '2022BCSE001', name: 'Alice' }];
    (apiClient.get as any).mockResolvedValueOnce({ data: mockRows });

    const result = await getRows('d1');
    expect(apiClient.get).toHaveBeenCalledWith('/spreadsheet/drives/d1/rows');
    expect(result).toEqual(mockRows);
  });

  it('calls applyToDrive with correct URL and payload', async () => {
    const payload = { extraData: { preferredLocation: 'Bengaluru' } };
    const mockResp = { applicationId: 'app-1', driveId: 'd1', status: 'APPLIED' };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockResp });

    const result = await applyToDrive('d1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/spreadsheet/drives/d1/apply',
      payload
    );
    expect(result).toEqual(mockResp);
  });

  it('exposes all methods on spreadsheetService object', () => {
    expect(spreadsheetService.getRows).toBe(getRows);
    expect(spreadsheetService.applyToDrive).toBe(applyToDrive);
    expect(spreadsheetService.saveRowUpdate).toBe(saveRowUpdate);
  });
});
