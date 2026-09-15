'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
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
  purpose: UsagePurpose.General,
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

  it('renders a fractional quantity as a cooking fraction', () => {
    render(<UsageHistoryRow usage={makeRecord({ quantityUsed: 1.25 })} />);
    expect(screen.getByText('-1 1/4 L')).toBeTruthy();
  });

  it('rounds a quantity no fraction fits to three decimals', () => {
    render(<UsageHistoryRow usage={makeRecord({ quantityUsed: 177.4412 })} />);
    expect(screen.getByText('-177.441 L')).toBeTruthy();
  });

  it('keeps the sign of a negative adjustment on the formatted quantity', () => {
    render(
      <UsageHistoryRow
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          quantityUsed: -0.5,
        })}
      />,
    );
    expect(screen.getByText('-1/2 L')).toBeTruthy();
  });

  it('signs a consumption as a subtraction', () => {
    render(<UsageHistoryRow usage={makeRecord({ quantityUsed: 3 })} />);
    expect(screen.getByText(/^-/)).toBeTruthy();
  });

  it('signs a restock as an addition', () => {
    render(
      <UsageHistoryRow usage={makeRecord({ purpose: UsagePurpose.Restock })} />,
    );
    expect(screen.getByText(/^\+/)).toBeTruthy();
  });

  it('shows an adjustmentreason when the purpose is an adjustment', () => {
    render(
      <UsageHistoryRow
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
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
  it('renders a reason the server writes as local copy, never its English', () => {
    render(
      <UsageHistoryRow
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          adjustmentReason: 'stack merge reconciliation',
        })}
      />,
    );
    expect(screen.getByText('Adjustment after merging items')).toBeTruthy();
    expect(screen.queryByText('stack merge reconciliation')).toBeNull();
  });

  it('renders a reason a person typed as written', () => {
    render(
      <UsageHistoryRow
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          adjustmentReason: 'Spilled half',
        })}
      />,
    );
    expect(screen.getByText('Spilled half')).toBeTruthy();
  });
});
