import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import PublicPlacementHomePage from './page';
import * as drivesService from '@/services/drives.service';

describe('PublicPlacementHomePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders public placement dashboard with live KPI stats and branch breakdown', async () => {
    vi.spyOn(drivesService, 'getPublicPlacementStats').mockResolvedValueOnce({
      totalStudents: 50,
      totalPlaced: 35,
      placementRate: 70.0,
      highestPackage: 28.5,
      averagePackage: 14.2,
      totalDrives: 4,
      branchBreakdown: [
        { branch: 'CSE', total: 20, placed: 18, placementRate: 90.0 },
        { branch: 'ECE', total: 10, placed: 7, placementRate: 70.0 },
        { branch: 'EEE', total: 8, placed: 4, placementRate: 50.0 },
        { branch: 'IT', total: 6, placed: 4, placementRate: 66.7 },
        { branch: 'CIVIL', total: 3, placed: 1, placementRate: 33.3 },
        { branch: 'MCA', total: 3, placed: 1, placementRate: 33.3 },
      ],
      topCompanies: ['Google', 'Microsoft'],
      featuredDrives: [
        {
          id: 'drive-google',
          company: 'Google',
          role: 'SDE-1',
          packageCategory: 'DREAM',
          ctcLpa: 28.5,
          deadline: '2026-12-31T00:00:00.000Z',
          eligibleBranches: ['CSE', 'IT'],
          open: true,
        },
      ],
    });

    render(<PublicPlacementHomePage />);

    expect(screen.getAllByText(/CUCEK Placement Portal/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText(/Computer Science & Engineering/i)).toBeInTheDocument();
      expect(screen.getByText(/Electronics & Communication/i)).toBeInTheDocument();
      expect(screen.getByText(/90% rate/i)).toBeInTheDocument();
    });
  });
});
