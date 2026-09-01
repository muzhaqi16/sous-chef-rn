'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { PantryUsageHistory } from '../PantryUsageHistory';
import type { UsageRecord } from '../UsageHistoryRow';

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  formatDate: jest.fn((d: string) => `formatted:${d}`),
}));

const makeRecord = (
  id: string,
  overrides: Partial<UsageRecord> = {},
): { node: UsageRecord } => ({
  node: {
    id,
    usedAt: `2024-01-0${id}`,
    quantityUsed: 1,
    purpose: 'GENERAL',
    adjustmentReason: null,
    usageUnit: { symbol: 'L' },
    ...overrides,
  },
});

describe('PantryUsageHistory', () => {
  const onViewAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when there are no usage records', () => {
    const { toJSON } = render(
      <PantryUsageHistory usageRecords={[]} onViewAll={onViewAll} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('summarizes rather than listing — the ledger is unbounded', () => {
    render(
      <PantryUsageHistory
        usageRecords={[makeRecord('1'), makeRecord('2')]}
        totalCount={87}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByText('Usage History')).toBeTruthy();
    // The server's total, not the handful the detail query fetched.
    expect(screen.getByText('87')).toBeTruthy();
    expect(screen.getByText('formatted:2024-01-01')).toBeTruthy();
    // No second row: this is a summary.
    expect(screen.queryByText('formatted:2024-01-02')).toBeNull();
  });

  it('falls back to the fetched count when the server sent no total', () => {
    render(
      <PantryUsageHistory
        usageRecords={[makeRecord('1'), makeRecord('2')]}
        onViewAll={onViewAll}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('opens the full history when tapped', async () => {
    const user = userEvent.setup();
    render(
      <PantryUsageHistory
        usageRecords={[makeRecord('1')]}
        onViewAll={onViewAll}
      />,
    );

    await user.press(screen.getByText('View Details'));
    expect(onViewAll).toHaveBeenCalled();
  });
});
