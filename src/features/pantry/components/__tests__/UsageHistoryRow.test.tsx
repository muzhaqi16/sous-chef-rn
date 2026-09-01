'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  UsageHistoryRow,
  type UsageRecord,
} from '#features/pantry/components/UsageHistoryRow';

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  formatDate: jest.fn((d: string) => `formatted:${d}`),
}));

const makeRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
  id: '1',
  usedAt: '2024-01-01',
  quantityUsed: 1,
  purpose: 'GENERAL',
  adjustmentReason: null,
  usageUnit: { symbol: 'L' },
  ...overrides,
});

describe('UsageHistoryRow', () => {
  it('shows the date and the quantity with its unit symbol', () => {
    render(<UsageHistoryRow usage={makeRecord({ quantityUsed: 2 })} />);
    expect(screen.getByText('formatted:2024-01-01')).toBeTruthy();
    expect(screen.getByText(/2 L/)).toBeTruthy();
  });

  it('signs a consumption as a subtraction', () => {
    render(<UsageHistoryRow usage={makeRecord({ quantityUsed: 3 })} />);
    expect(screen.getByText(/^-/)).toBeTruthy();
  });

  it('signs a restock as an addition', () => {
    render(<UsageHistoryRow usage={makeRecord({ purpose: 'RESTOCK' })} />);
    expect(screen.getByText(/^\+/)).toBeTruthy();
  });

  it('shows an adjustmentreason when the purpose is an adjustment', () => {
    render(
      <UsageHistoryRow
        usage={makeRecord({
          purpose: 'ADJUSTMENT',
          adjustmentReason: 'Miscounted',
        })}
      />,
    );
    expect(screen.getByText('Miscounted')).toBeTruthy();
  });

  it('omits the unit when the record carries none', () => {
    render(<UsageHistoryRow usage={makeRecord({ usageUnit: null })} />);
    expect(screen.queryByText(/L/)).toBeNull();
  });
});
