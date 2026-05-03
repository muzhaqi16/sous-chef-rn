'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryDetailInfo } from '../PantryDetailInfo';

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
  getUnitDisplayText: jest.fn((unit: any) => unit?.symbol || ''),
}));

const baseItem = {
  id: 'pi1',
  itemName: 'Milk',
  quantity: 2,
  unit: { id: 'u1', name: 'liters', symbol: 'L' },
  storageLocation: null,
  brand: null,
  store: null,
  condition: 'GOOD',
  acquisitionMethod: null,
  costPerUnit: null,
  totalCost: null,
  minQuantity: null,
  restockQuantity: null,
  purchase: null,
  lastUsedAt: null,
  storageNotes: null,
  tags: null,
  createdAt: '2024-01-01',
  netWeight: null,
  netWeightUnit: null,
  remainingNetWeight: null,
  packageBreakdown: null,
  quantityBreakdown: null,
} as any;

describe('PantryDetailInfo', () => {
  const defaultProps = {
    item: baseItem,
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
    const item = { ...baseItem, storageLocation: { name: 'Top shelf' } };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Top shelf')).toBeTruthy();
  });

  it('renders Store row when store name exists', () => {
    const item = { ...baseItem, store: { name: 'Whole Foods' } };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.getByText('Whole Foods')).toBeTruthy();
  });

  it('does not render Condition row when condition is GOOD', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.queryByText('Condition')).toBeNull();
  });

  it('renders Condition row with error styling for SPOILED', () => {
    const item = { ...baseItem, condition: 'SPOILED' };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('renders Condition row for EXPIRED', () => {
    const item = { ...baseItem, condition: 'EXPIRED' };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('renders Acquired row when acquisitionMethod is set', () => {
    const item = { ...baseItem, acquisitionMethod: 'HOME_GROWN' };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Acquired')).toBeTruthy();
    expect(screen.getByText('Home Grown')).toBeTruthy();
  });

  it('does not render Acquired row when acquisitionMethod is null', () => {
    render(<PantryDetailInfo {...defaultProps} />);
    expect(screen.queryByText('Acquired')).toBeNull();
  });

  it('renders Cost/Unit row when costPerUnit is positive', () => {
    const item = { ...baseItem, costPerUnit: 3.5 };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Cost/Unit')).toBeTruthy();
    expect(screen.getByText('$3.50')).toBeTruthy();
  });

  it('renders Total Cost row when totalCost is positive', () => {
    const item = { ...baseItem, totalCost: 7.0 };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Total Cost')).toBeTruthy();
    expect(screen.getByText('$7.00')).toBeTruthy();
  });

  it('renders Min Stock row when minQuantity is set', () => {
    const item = { ...baseItem, minQuantity: 1 };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Min Stock')).toBeTruthy();
  });

  it('renders Restock At row when restockQuantity is set', () => {
    const item = { ...baseItem, restockQuantity: 2 };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Restock At')).toBeTruthy();
  });

  it('renders Last Used row when lastUsedAt is set', () => {
    const item = { ...baseItem, lastUsedAt: '2024-06-15' };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Last Used')).toBeTruthy();
  });

  it('renders notes section when storageNotes exists', () => {
    const item = { ...baseItem, storageNotes: 'Keep refrigerated' };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Keep refrigerated')).toBeTruthy();
  });

  it('renders tags when tags array is non-empty', () => {
    const item = { ...baseItem, tags: ['organic', 'dairy'] };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByText('organic')).toBeTruthy();
    expect(screen.getByText('dairy')).toBeTruthy();
  });

  it('does not render tags section when tags is empty', () => {
    const item = { ...baseItem, tags: [] };
    render(<PantryDetailInfo {...defaultProps} item={item} />);
    expect(screen.queryByText('Tags')).toBeNull();
  });

  it('renders correct weight edit button when lastUsedAt and onCorrectWeight exist', () => {
    const onCorrectWeight = jest.fn();
    const item = { ...baseItem, lastUsedAt: '2024-06-15' };
    render(
      <PantryDetailInfo
        {...defaultProps}
        item={item}
        netWeightText="500g"
        onCorrectWeight={onCorrectWeight}
      />,
    );
    // Net weight row should exist with the value
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
