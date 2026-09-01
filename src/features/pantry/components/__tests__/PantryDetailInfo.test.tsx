'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo as render } from '#/test-utils/apolloMockProvider';
import { PantryDetailInfo } from '../PantryDetailInfo';
import type { PantryDetailInfo_PantryItemFragment } from '../PantryDetailInfo.generated';
import {
  AcquisitionMethod,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  formatCondition: jest.fn((c: string | null | undefined) => {
    if (!c || c === 'GOOD') return null;
    return c.charAt(0) + c.slice(1).toLowerCase();
  }),
  formatAcquisitionMethod: jest.fn((m: string | null | undefined) => {
    if (!m) return null;
    return m
      .split('_')
      .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }),
  formatCurrency: jest.fn((a: number | null | undefined) => {
    if (a == null || a <= 0) return null;
    return `$${a.toFixed(2)}`;
  }),
  formatDate: jest.fn((d: string | null | undefined) => {
    if (!d) return null;
    return 'Jan 1, 2024';
  }),
}));

jest.mock('#utils/formatQuantity', () => ({
  getUnitDisplayText: jest.fn(
    (unit?: { symbol?: string; name?: string } | null) => unit?.symbol || '',
  ),
}));

// Typed against the component's own generated fragment — only the fields the
// fragment actually selects, with the real enum/nullability shapes. (`condition`
// and `acquisitionMethod` are non-null enums; `tags` is a non-null array; nested
// entities carry `__typename` + `id`.)
const baseItem: PantryDetailInfo_PantryItemFragment = {
  __typename: 'PantryItem',
  id: 'pi1',
  quantity: 2,
  unit: { __typename: 'Unit', id: 'u1', name: 'liters', symbol: 'L' },
  storageLocation: null,
  brand: null,
  store: null,
  condition: ItemCondition.Good,
  acquisitionMethod: AcquisitionMethod.Purchased,
  costPerUnit: null,
  totalCost: null,
  minQuantity: null,
  restockQuantity: null,
  purchase: null,
  lastUsedAt: null,
  storageNotes: null,
  tags: [],
  createdAt: '2024-01-01',
};

describe('PantryDetailInfo', () => {
  const defaultProps = {
    itemRef: baseItem,
    brandName: null as string | null,
    netWeightText: null as string | null,
    remainingNetWeightText: null as string | null,
    quantityBreakdownText: null as string | null,
    packageBreakdownText: null as string | null,
    shelfLifeDays: null as number | null | undefined,
    shelfLifeOpenedDays: null as number | null | undefined,
  };

  it('always renders Quantity row', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('2 L')).toBeTruthy();
  });

  it('shows the total paid on the Purchased row, not the unit price', () => {
    render(
      <PantryDetailInfo
        {...defaultProps}
        itemRef={{
          ...baseItem,
          quantity: 5,
          costPerUnit: 0.59,
          totalCost: 2.95,
          purchase: {
            __typename: 'Purchase',
            id: 'pu1',
            purchaseDate: '2026-08-30T00:00:00Z',
            unitPrice: 0.59,
            totalPrice: 2.95,
          },
        }}
      />,
    );
    // Cost/Unit already carries the 0.59; repeating it here read as a bug.
    expect(screen.getByText('Jan 1, 2024 · $2.95')).toBeTruthy();
    expect(screen.getByText('$0.59')).toBeTruthy();
    expect(screen.getByText('$2.95')).toBeTruthy();
  });

  it('always renders Added row', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.getByText('Added')).toBeTruthy();
    expect(screen.getByText('Jan 1, 2024')).toBeTruthy();
  });

  it('renders Brand row when brandName is provided', () => {
    render(<PantryDetailInfo {...defaultProps} brandName="Organic Valley" />);
    expect(screen.getByText('Brand')).toBeTruthy();
    expect(screen.getByText('Organic Valley')).toBeTruthy();
  });

  it('does not render Brand row when brandName is null', () => {
    render(<PantryDetailInfo {...defaultProps} brandName={null} />);
    expect(screen.queryByText('Brand')).toBeNull();
  });

  it('renders Net Weight row when netWeightText is provided', () => {
    render(<PantryDetailInfo {...defaultProps} netWeightText="500g" />);
    expect(screen.getByText('Net Weight')).toBeTruthy();
  });

  it('does not render Net Weight row when netWeightText is null', () => {
    render(<PantryDetailInfo {...defaultProps} netWeightText={null} />);
    expect(screen.queryByText('Net Weight')).toBeNull();
  });

  it('renders Remaining Weight row when provided', () => {
    render(
      <PantryDetailInfo {...defaultProps} remainingNetWeightText="350g" />,
    );
    expect(screen.getByText('Remaining Weight')).toBeTruthy();
  });

  it('renders Inventory row when quantityBreakdownText is provided', () => {
    render(
      <PantryDetailInfo {...defaultProps} quantityBreakdownText="6 cans" />,
    );
    expect(screen.getByText('Inventory')).toBeTruthy();
    expect(screen.getByText('6 cans')).toBeTruthy();
  });

  it('renders Package row when packageBreakdownText is provided', () => {
    render(
      <PantryDetailInfo
        {...defaultProps}
        packageBreakdownText="6 x 330ml cans"
      />,
    );
    expect(screen.getByText('Package')).toBeTruthy();
    expect(screen.getByText('6 x 330ml cans')).toBeTruthy();
  });

  it('renders Storage row when storageLocation is set', () => {
    const item = {
      ...baseItem,
      storageLocation: {
        __typename: 'StorageLocation' as const,
        id: 'sl1',
        name: 'Top shelf',
      },
    };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Top shelf')).toBeTruthy();
  });

  it('renders Store row when store name exists', () => {
    const item = {
      ...baseItem,
      store: { __typename: 'Store' as const, id: 'st1', name: 'Whole Foods' },
    };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.getByText('Whole Foods')).toBeTruthy();
  });

  it('does not render Condition row when condition is GOOD', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.queryByText('Condition')).toBeNull();
  });

  it('renders Condition row with error styling for SPOILED', () => {
    const item = { ...baseItem, condition: ItemCondition.Spoiled };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('renders Condition row for EXPIRED', () => {
    const item = { ...baseItem, condition: ItemCondition.Expired };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('renders Acquired row with a multi-word acquisition method', () => {
    const item = {
      ...baseItem,
      acquisitionMethod: AcquisitionMethod.ShoppingList,
    };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Acquired')).toBeTruthy();
    expect(screen.getByText('Shopping List')).toBeTruthy();
  });

  // acquisitionMethod is non-null in the schema, so the row always renders.
  it('renders Acquired row for the item acquisition method', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.getByText('Acquired')).toBeTruthy();
    expect(screen.getByText('Purchased')).toBeTruthy();
  });

  it('renders Cost/Unit row when costPerUnit is positive', () => {
    const item = { ...baseItem, costPerUnit: 3.5 };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Cost/Unit')).toBeTruthy();
    expect(screen.getByText('$3.50')).toBeTruthy();
  });

  it('renders the stock-value row when totalCost is positive', () => {
    const item = { ...baseItem, totalCost: 7.0 };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Stock value')).toBeTruthy();
    expect(screen.getByText('$7.00')).toBeTruthy();
  });

  describe('money the server derived from the batches', () => {
    it('says the rate is an average, and names the last purchase', () => {
      // The server already values the remaining stock; the batches only decide
      // how to label it.
      const item = { ...baseItem, costPerUnit: 0.74, totalCost: 5.95 };
      render(
        <PantryDetailInfo
          {...defaultProps}
          itemRef={item}
          pricing={{
            isAveraged: true,
            isRateDiluted: false,
            lastPurchase: { date: '2026-08-31T00:00:00Z', totalCost: 3 },
          }}
        />,
      );

      expect(screen.getByText('Avg Cost/Unit')).toBeTruthy();
      expect(screen.getByText('$0.74')).toBeTruthy();
      expect(screen.getByText('Stock value')).toBeTruthy();
      expect(screen.getByText('$5.95')).toBeTruthy();
      expect(screen.getByText('Last purchase')).toBeTruthy();
    });

    it('keeps the plain labels for a stack with one purchase behind it', () => {
      const item = { ...baseItem, costPerUnit: 0.59, totalCost: 2.95 };
      render(
        <PantryDetailInfo
          {...defaultProps}
          itemRef={item}
          pricing={{
            isAveraged: false,
            isRateDiluted: false,
            lastPurchase: null,
          }}
        />,
      );

      expect(screen.getByText('Cost/Unit')).toBeTruthy();
      expect(screen.queryByText('Avg Cost/Unit')).toBeNull();
      expect(screen.queryByText('Last purchase')).toBeNull();
    });

    it('hides the rate when unpriced stock dilutes it below any price paid', () => {
      // totalCost covers only the priced batches; costPerUnit spreads it over
      // ALL units, so the rate is not a price anyone paid. The value stands.
      const item = { ...baseItem, costPerUnit: 0.3, totalCost: 2.95 };
      render(
        <PantryDetailInfo
          {...defaultProps}
          itemRef={item}
          pricing={{
            isAveraged: false,
            isRateDiluted: true,
            lastPurchase: null,
          }}
        />,
      );

      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('$0.30')).toBeNull();
      expect(screen.getByText('Stock value')).toBeTruthy();
      expect(screen.getByText('$2.95')).toBeTruthy();
    });

    it('omits both rows when no remaining stock has a known cost', () => {
      // Null, not zero — rendering $0.00 would claim the stock was free.
      const item = { ...baseItem, costPerUnit: null, totalCost: null };
      render(
        <PantryDetailInfo
          {...defaultProps}
          itemRef={item}
          pricing={{
            isAveraged: false,
            isRateDiluted: false,
            lastPurchase: null,
          }}
        />,
      );

      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('Stock value')).toBeNull();
      expect(screen.queryByText('$0.00')).toBeNull();
    });
  });

  it('renders Min Stock row when minQuantity is set', () => {
    const item = { ...baseItem, minQuantity: 1 };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Min Stock')).toBeTruthy();
  });

  it('renders Restock At row when restockQuantity is set', () => {
    const item = { ...baseItem, restockQuantity: 2 };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Restock At')).toBeTruthy();
  });

  it('renders Last Used row when lastUsedAt is set', () => {
    const item = { ...baseItem, lastUsedAt: '2024-06-15' };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Last Used')).toBeTruthy();
  });

  it('renders notes section when storageNotes exists', () => {
    const item = { ...baseItem, storageNotes: 'Keep refrigerated' };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Keep refrigerated')).toBeTruthy();
  });

  it('renders tags when tags array is non-empty', () => {
    const item = { ...baseItem, tags: ['organic', 'dairy'] };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByText('organic')).toBeTruthy();
    expect(screen.getByText('dairy')).toBeTruthy();
  });

  it('does not render tags section when tags is empty', () => {
    const item = { ...baseItem, tags: [] };
    render(<PantryDetailInfo {...defaultProps} itemRef={item} />);
    expect(screen.queryByText('Tags')).toBeNull();
  });

  it('renders correct weight edit button when lastUsedAt and onCorrectWeight exist', () => {
    const onCorrectWeight = jest.fn();
    const item = { ...baseItem, lastUsedAt: '2024-06-15' };
    render(
      <PantryDetailInfo
        {...defaultProps}
        itemRef={item}
        netWeightText="500g"
        onCorrectWeight={onCorrectWeight}
      />,
    );
    expect(screen.getByText('Net Weight')).toBeTruthy();
    expect(screen.getByText('500g')).toBeTruthy();
  });

  it('does not render correct weight edit button when lastUsedAt is null', () => {
    const onCorrectWeight = jest.fn();
    render(
      <PantryDetailInfo
        {...defaultProps}
        netWeightText="500g"
        onCorrectWeight={onCorrectWeight}
      />,
    );
    expect(screen.getByText('Net Weight')).toBeTruthy();
  });

  it('renders Shelf Life row with both unopened and opened days', () => {
    render(
      <PantryDetailInfo
        {...defaultProps}
        shelfLifeDays={365}
        shelfLifeOpenedDays={180}
      />,
    );
    expect(screen.getByText('Shelf Life')).toBeTruthy();
    expect(screen.getByText('365d (180d once opened)')).toBeTruthy();
  });

  it('renders Shelf Life row with only unopened days', () => {
    render(<PantryDetailInfo {...defaultProps} shelfLifeDays={365} />);
    expect(screen.getByText('Shelf Life')).toBeTruthy();
    expect(screen.getByText('365 days')).toBeTruthy();
  });

  it('does not render Shelf Life row when both are null', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.queryByText('Shelf Life')).toBeNull();
  });
});
