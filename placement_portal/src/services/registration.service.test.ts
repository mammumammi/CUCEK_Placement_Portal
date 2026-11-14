import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeBulkRegistration,
  previewBulkRegistration,
  commitBulkRegistration,
} from './registration.service';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('Registration Service (Frontend)', () => {
  const dummyFile = new File(['dummy-excel-content'], 'students.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeBulkRegistration', () => {
    it('calls POST /registration/analyze with multipart/form-data', async () => {
      const mockResponse = {
        sheets: [
          {
            sheetName: 'Students',
            headerRow: 3,
            headers: ['Reg No', 'Candidate Name', 'Dept', 'Batch', 'Email', 'Phone'],
            rowCount: 20,
            mapping: {
              'Reg No': { field: 'studentId', confidence: 1, source: 'exact' as const },
              'Candidate Name': { field: 'name', confidence: 1, source: 'exact' as const },
            },
            missingRequired: [],
          },
        ],
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await analyzeBulkRegistration(dummyFile);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const [url, formData, config] = vi.mocked(apiClient.post).mock.calls[0];
      expect(url).toBe('/registration/analyze');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).get('file')).toBe(dummyFile);
      expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('previewBulkRegistration', () => {
    it('calls POST /registration/preview with file and optional mapping payload', async () => {
      const mockPreview = {
        rows: [],
        summary: {
          total: 0,
          valid: 0,
          invalid: 0,
          duplicatesInFile: 0,
          duplicatesInDb: 0,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPreview });

      const mapping = { 'Reg No': 'studentId', 'Candidate Name': 'name' };
      const result = await previewBulkRegistration(dummyFile, mapping);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const [url, formData] = vi.mocked(apiClient.post).mock.calls[0];
      expect(url).toBe('/registration/preview');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).get('file')).toBe(dummyFile);
      expect((formData as FormData).get('mapping')).toBe(JSON.stringify(mapping));
      expect(result).toEqual(mockPreview);
    });
  });

  describe('commitBulkRegistration', () => {
    it('calls POST /registration/commit with query params and mapping', async () => {
      const mockCommit = { created: 10, skipped: 0 };
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockCommit });

      const mapping = { 'Roll No': 'studentId' };
      const result = await commitBulkRegistration(dummyFile, {
        skipInvalid: true,
        mapping,
      });

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const [url, formData, config] = vi.mocked(apiClient.post).mock.calls[0];
      expect(url).toBe('/registration/commit');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).get('file')).toBe(dummyFile);
      expect((formData as FormData).get('mapping')).toBe(JSON.stringify(mapping));
      expect(config?.params).toEqual({ skipInvalid: 'true' });
      expect(result).toEqual(mockCommit);
    });
  });
});

