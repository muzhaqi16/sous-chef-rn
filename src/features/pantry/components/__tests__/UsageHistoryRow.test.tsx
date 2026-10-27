'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  AdjustmentKind,
  UnitSystem,
  UnitType,
  UsagePurpose,
} from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { UsageHistoryRow } from '#features/pantry/components/UsageHistoryRow';
import type { UsageRecord } from '#features/pantry/types';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  formatDate: jest.fn((d: string) => `formatted:${d}`),
}));

const makeRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
  id: '1',
  usedAt: '2024-01-01',
  quantityUsed: 1,
  purpose: UsagePurpose.General,
  adjustmentKind: null,
  adjustmentReason: null,
  usageUnit: { symbol: 'L' },
  ...overrides,
});

describe('UsageHistoryRow', () => {
  afterEach(() => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  });

  it('shows the date and the quantity with its unit symbol', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ quantityUsed: 2 })}
      />,
    );
    expect(screen.getByText('formatted:2024-01-01')).toBeTruthy();
    expect(screen.getByText(/2 L/)).toBeTruthy();
  });

  it('renders a fractional quantity as a cooking fraction', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ quantityUsed: 1.25 })}
      />,
    );
    expect(screen.getByText('-1 1/4 L')).toBeTruthy();
  });

  it('rounds a quantity no fraction fits to three decimals', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ quantityUsed: 177.4412 })}
      />,
    );
    expect(screen.getByText('-177.441 L')).toBeTruthy();
  });

  it('keeps the sign of a negative adjustment on the formatted quantity', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          quantityUsed: -0.5,
        })}
      />,
    );
    expect(screen.getByText('-1/2 L')).toBeTruthy();
  });

  it('signs a consumption as a subtraction', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ quantityUsed: 3 })}
      />,
    );
    expect(screen.getByText(/^-/)).toBeTruthy();
  });

  it('signs a restock as an addition', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ purpose: UsagePurpose.Restock })}
      />,
    );
    expect(screen.getByText(/^\+/)).toBeTruthy();
  });

  it('shows what a restock was bought for, in its own currency', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Restock,
          totalCost: 1.49,
          currency: { code: 'USD' },
        })}
      />,
    );
    expect(screen.getByText('$1.49')).toBeTruthy();
  });

  it('shows no price when the purchase recorded none', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ purpose: UsagePurpose.Restock, totalCost: null })}
      />,
    );
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows no price with budget & prices off, and still the restock', () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Restock,
          totalCost: 1.49,
          currency: { code: 'USD' },
        })}
      />,
    );
    expect(screen.queryByText(/1\.49/)).toBeNull();
    expect(screen.getByText('formatted:2024-01-01')).toBeTruthy();
    expect(screen.getByText('+1 L')).toBeTruthy();
  });

  it("shows a person's correction reason when their kind says it is theirs", () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          adjustmentKind: AdjustmentKind.User,
          adjustmentReason: 'Miscounted',
        })}
      />,
    );
    expect(screen.getByText('Miscounted')).toBeTruthy();
  });

  it('omits the unit when the record carries none', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({ usageUnit: null })}
      />,
    );
    expect(screen.queryByText(/L/)).toBeNull();
  });
  it.each([
    [AdjustmentKind.StackMerge, 'Adjustment after merging items'],
    [AdjustmentKind.StackPurged, 'Administrative removal'],
    [AdjustmentKind.StackRemoved, 'Removed from the pantry'],
  ])(
    'renders %s as local copy, never the server reason beside it',
    (kind, copy) => {
      render(
        <UsageHistoryRow
          readingSystem={UnitSystem.Imperial}
          usage={makeRecord({
            purpose: UsagePurpose.Adjustment,
            adjustmentKind: kind,
            adjustmentReason: 'stack merge reconciliation',
          })}
        />,
      );
      expect(screen.getByText(copy)).toBeTruthy();
      expect(screen.queryByText('stack merge reconciliation')).toBeNull();
    },
  );

  it('renders a reason a person typed as written', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Adjustment,
          adjustmentKind: AdjustmentKind.User,
          adjustmentReason: 'Spilled half',
        })}
      />,
    );
    expect(screen.getByText('Spilled half')).toBeTruthy();
  });

  it('renders a correction on a RESTOCK row, which carries a kind too', () => {
    // A correction that FINDS stock is recorded against RESTOCK. Gating the
    // line on the purpose would hide it.
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Restock,
          adjustmentKind: AdjustmentKind.User,
          adjustmentReason: 'Found two more at the back',
        })}
      />,
    );
    expect(screen.getByText('Found two more at the back')).toBeTruthy();
  });

  it('shows no correction line on an ordinary row carrying no kind', () => {
    render(
      <UsageHistoryRow
        readingSystem={UnitSystem.Imperial}
        usage={makeRecord({
          purpose: UsagePurpose.Restock,
          adjustmentReason: 'stack merge reconciliation',
        })}
      />,
    );
    expect(screen.queryByText('stack merge reconciliation')).toBeNull();
    expect(screen.queryByText('Adjustment after merging items')).toBeNull();
  });

  // A recount typed as "2.5 lb" on a gram stack says so, in the reader's system.
  describe('a recount stated in a unit', () => {
    const reading = (value: number, unitId: string, symbol: string) => ({
      value,
      unitId,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });
    const recount = makeRecord({
      purpose: UsagePurpose.Adjustment,
      adjustmentKind: AdjustmentKind.User,
      quantityUsed: -226.8,
      usageUnit: { symbol: 'g' },
      statedAmount: {
        metric: reading(1.13, 'unit-kg', 'kg'),
        imperial: reading(2.5, 'unit-lb', 'lb'),
      },
    });

    it.each([
      [UnitSystem.Imperial, '2.5 lb'],
      [UnitSystem.Metric, '1.13 kg'],
    ] as const)('reads it in %s as %s', (system, amount) => {
      render(<UsageHistoryRow usage={recount} readingSystem={system} />);
      expect(
        screen.getByText(t('adjustQuantity.countedAs', { amount })),
      ).toBeTruthy();
    });

    it('says nothing of the kind on any other row', () => {
      render(
        <UsageHistoryRow
          usage={makeRecord()}
          readingSystem={UnitSystem.Imperial}
        />,
      );
      expect(screen.queryByText(/2\.5 lb/)).toBeNull();
    });
  });
});
