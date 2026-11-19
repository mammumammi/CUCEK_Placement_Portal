import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';
import {
  listDrives,
  getDriveById,
  createDrive,
  summarizeJd,
  notifyEligibleStudents,
  getDriveStats,
  getPublicPlacementStats,
  updateDriveExtraFields,
  parseCompanyTemplate,
  downloadDriveExport,
} from './drives.service';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Drives Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listDrives calls GET /drives', async () => {
    const mockDrives = [
      {
        id: 'drive-1',
        company: 'Google',
        role: 'SDE',
        packageCategory: 'DREAM',
        ctcLpa: 24,
        open: true,
      },
    ];
    (apiClient.get as any).mockResolvedValueOnce({ data: mockDrives });

    const result = await listDrives();
    expect(apiClient.get).toHaveBeenCalledWith('/drives');
    expect(result).toEqual(mockDrives);
  });

  it('getDriveById calls GET /drives/:id', async () => {
    const mockDrive = {
      id: 'drive-123',
      company: 'Microsoft',
      role: 'SWE',
      packageCategory: 'DREAM',
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockDrive });

    const result = await getDriveById('drive-123');
    expect(apiClient.get).toHaveBeenCalledWith('/drives/drive-123');
    expect(result).toEqual(mockDrive);
  });

  it('createDrive calls POST /drives with multipart headers', async () => {
    const formData = new FormData();
    formData.append('company', 'Amazon');
    const mockCreated = { id: 'drive-456', company: 'Amazon' };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockCreated });

    const result = await createDrive(formData);
    expect(apiClient.post).toHaveBeenCalledWith('/drives', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(result).toEqual(mockCreated);
  });

  it('summarizeJd calls POST /drives/summarize-jd with form data', async () => {
    const mockSummary = {
      company: 'Adobe',
      role: 'MTS-1',
      packageCategory: 'DREAM',
      ctcLpa: 16.5,
      minCgpa: 7.5,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      eligibleBranches: ['CSE', 'IT'],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockSummary });

    const result = await summarizeJd({ text: 'Sample JD content' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/drives/summarize-jd',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    expect(result).toEqual(mockSummary);
  });

  it('notifyEligibleStudents calls POST /drives/:id/notify', async () => {
    const mockResult = {
      driveId: 'drive-1',
      driveTitle: 'Google SDE',
      totalEligible: 25,
      sentCount: 25,
      recipients: [],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockResult });

    const result = await notifyEligibleStudents('drive-1', 'http://localhost:3000');
    expect(apiClient.post).toHaveBeenCalledWith('/drives/drive-1/notify', {
      baseUrl: 'http://localhost:3000',
    });
    expect(result).toEqual(mockResult);
  });

  it('getDriveStats calls GET /drives/:id/stats', async () => {
    const mockStats = {
      driveId: 'drive-1',
      company: 'Google',
      totalApplications: 40,
      verifiedApplications: 35,
      pendingApplications: 5,
      placedCount: 8,
      totalRounds: 3,
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockStats });

    const result = await getDriveStats('drive-1');
    expect(apiClient.get).toHaveBeenCalledWith('/drives/drive-1/stats');
    expect(result).toEqual(mockStats);
  });

  it('getPublicPlacementStats calls GET /drives/public-stats', async () => {
    const mockPublic = {
      totalStudents: 100,
      totalPlaced: 85,
      placementRate: 85.0,
      highestPackage: 28.5,
      averagePackage: 10.2,
      totalDrives: 12,
      branchBreakdown: [],
      topCompanies: ['Google', 'Microsoft'],
      featuredDrives: [],
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockPublic });

    const result = await getPublicPlacementStats();
    expect(apiClient.get).toHaveBeenCalledWith('/drives/public-stats');
    expect(result).toEqual(mockPublic);
  });

  it('updateDriveExtraFields calls PATCH /drives/:id/extra-fields', async () => {
    const mockRes = {
      driveId: 'drive-1',
      extraFields: [{ key: 'github', label: 'GitHub', type: 'text' as const, required: false }],
    };
    (apiClient.patch as any).mockResolvedValueOnce({ data: mockRes });

    const result = await updateDriveExtraFields('drive-1', {
      newField: { key: 'github', label: 'GitHub', type: 'text', required: false },
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/drives/drive-1/extra-fields', {
      newField: { key: 'github', label: 'GitHub', type: 'text', required: false },
    });
    expect(result).toEqual(mockRes);
  });

  it('summarizeJd supports multiple uploaded PDF files', async () => {
    const file1 = new File(['pdf1 content'], 'jd.pdf', { type: 'application/pdf' });
    const file2 = new File(['pdf2 content'], 'guidelines.pdf', { type: 'application/pdf' });
    const mockSummary = {
      company: 'TCS',
      role: 'System Engineer',
      packageCategory: 'GENERAL' as const,
      ctcLpa: 4.5,
      minCgpa: 6.0,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      summary: 'TCS recruitment drive',
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockSummary });

    const result = await summarizeJd({ files: [file1, file2] });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/drives/summarize-jd',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    expect(result).toEqual(mockSummary);
  });

  it('parseCompanyTemplate calls POST /drives/parse-company-template', async () => {
    const file = new File(['xlsx content'], 'Company_Template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const mockParsed = {
      headers: ['Candidate Name', 'USN', 'Branch', 'CGPA'],
      suggestedColumns: [
        { companyHeader: 'Candidate Name', sourceField: 'name' },
        { companyHeader: 'USN', sourceField: 'registrationNumber' },
        { companyHeader: 'Branch', sourceField: 'branch' },
        { companyHeader: 'CGPA', sourceField: 'cgpa' },
      ],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockParsed });

    const result = await parseCompanyTemplate(file);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/drives/parse-company-template',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    expect(result).toEqual(mockParsed);
  });

  it('downloadDriveExport requests company format export endpoint when specified', async () => {
    (apiClient.get as any).mockResolvedValueOnce({ data: new ArrayBuffer(8) });
    // Mock DOM download elements
    const origCreateObjectURL = window.URL.createObjectURL;
    const origRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    await downloadDriveExport('drive-99', { format: 'company', companyName: 'Amazon' });

    expect(apiClient.get).toHaveBeenCalledWith('/drives/drive-99/export-company', {
      responseType: 'blob',
    });

    window.URL.createObjectURL = origCreateObjectURL;
    window.URL.revokeObjectURL = origRevokeObjectURL;
  });
});

