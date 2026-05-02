'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PantryUsageHistory } from '../PantryUsageHistory';

jest.mock('#hooks/pantry/usePantryItemTransformation', () => ({
  formatDate: jest.fn((d: string) => `formatted:${d}`),
}));

const makeRecord = (id: string, overrides: Record<string, any> = {}) => ({
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
  const defaultProps = {
    expanded: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when there are no usage records', () => {
    const { toJSON } = render(
      <PantryUsageHistory {...defaultProps} usageRecords={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders CollapsibleSection with title and record count', () => {
    render(
      <PantryUsageHistory {...defaultProps} usageRecords={[makeRecord('1')]} />,
    );
    expect(screen.getByText('Usage History (1)')).toBeTruthy();
  });

  it('does not render records when collapsed', () => {
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={false}
        usageRecords={[makeRecord('1')]}
      />,
    );
    expect(screen.queryByText('formatted:2024-01-01')).toBeNull();
  });

  it('renders records when expanded', () => {
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={true}
        usageRecords={[makeRecord('1')]}
      />,
    );
    expect(screen.getByText('formatted:2024-01-01')).toBeTruthy();
    expect(screen.getByText('Consumed')).toBeTruthy();
  });

  it('shows quantity with unit symbol', () => {
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={true}
        usageRecords={[makeRecord('1', { quantityUsed: 3 })]}
      />,
    );
    expect(screen.getByText(/-3 L/)).toBeTruthy();
  });

  it('shows + prefix for restock records', () => {
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={true}
        usageRecords={[
          makeRecord('1', { purpose: 'RESTOCK', quantityUsed: 5 }),
        ]}
      />,
    );
    expect(screen.getByText(/\+5 L/)).toBeTruthy();
    expect(screen.getByText('Restocked')).toBeTruthy();
  });

  it('shows adjustment records with reason', () => {
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={true}
        usageRecords={[
          makeRecord('1', {
            purpose: 'ADJUSTMENT',
            quantityUsed: 2,
            adjustmentReason: 'Inventory count',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Inventory adjusted')).toBeTruthy();
    expect(screen.getByText('Inventory count')).toBeTruthy();
  });

  it('shows only first 5 records and "+N more entries" when more than 5', () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      makeRecord(String(i + 1)),
    );
    render(
      <PantryUsageHistory
        {...defaultProps}
        expanded={true}
        usageRecords={records}
      />,
    );
    expect(screen.getByText('+2 more entries')).toBeTruthy();
  });

  it('calls onToggle when header is pressed', () => {
    const onToggle = jest.fn();
    render(
      <PantryUsageHistory
        {...defaultProps}
        onToggle={onToggle}
        usageRecords={[makeRecord('1')]}
      />,
    );
    fireEvent.press(screen.getByText('Usage History (1)'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
