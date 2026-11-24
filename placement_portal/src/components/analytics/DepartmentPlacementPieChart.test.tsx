import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { DepartmentPlacementPieChart } from './DepartmentPlacementPieChart';

describe('DepartmentPlacementPieChart', () => {
  const mockBranchBreakdown = [
    { branch: 'CSE', total: 40, placed: 10, placementRate: 25.0 },
    { branch: 'ECE', total: 10, placed: 5, placementRate: 50.0 },
    { branch: 'EEE', total: 10, placed: 3, placementRate: 30.0 },
    { branch: 'IT', total: 10, placed: 2, placementRate: 20.0 },
    { branch: 'CIVIL', total: 10, placed: 0, placementRate: 0.0 },
    { branch: 'MCA', total: 5, placed: 0, placementRate: 0.0 },
  ];

  it('renders correctly with given department placement data', () => {
    render(
      <DepartmentPlacementPieChart
        branchBreakdown={mockBranchBreakdown}
        totalStudents={85}
        totalPlaced={20}
      />
    );

    expect(screen.getByTestId('department-placement-pie-chart')).toBeDefined();
    expect(screen.getByText('Department Placement Share')).toBeDefined();
    expect(screen.getByText('20 Total Placed')).toBeDefined();
    expect(screen.getByText('85 Enrolled')).toBeDefined();

    // CSE has 10/20 = 50%
    expect(screen.getByText('50%')).toBeDefined();
    // ECE has 5/20 = 25%
    expect(screen.getByText('25%')).toBeDefined();
    // EEE has 3/20 = 15%
    expect(screen.getByText('15%')).toBeDefined();
    // IT has 2/20 = 10%
    expect(screen.getByText('10%')).toBeDefined();
    // CIVIL has 0%
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty data gracefully without crashing', () => {
    render(<DepartmentPlacementPieChart branchBreakdown={[]} />);
    expect(screen.getByTestId('department-placement-pie-chart')).toBeDefined();
    expect(screen.getByText('0 Total Placed')).toBeDefined();
  });

  it('updates center text on hover over department item', () => {
    render(
      <DepartmentPlacementPieChart
        branchBreakdown={mockBranchBreakdown}
        totalPlaced={20}
      />
    );

    // Hover over CSE card
    const cseItem = screen.getByText('CSE').closest('div');
    if (cseItem) {
      fireEvent.mouseEnter(cseItem);
      expect(screen.getByText('50% of placements')).toBeDefined();
    }
  });
});
