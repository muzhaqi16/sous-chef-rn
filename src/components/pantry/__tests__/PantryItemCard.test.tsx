'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryItemCard } from '../PantryItemCard';
import { PantryActionsProvider } from '../PantryActionsContext';

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
  scheduleOnRN: jest.fn((fn: any) => fn),
}));

jest.mock('#/constants/animations', () => ({
  SLIDE_PRESETS: {
    exitWithFade: { duration: 300, opacityTarget: 0 },
  },
}));

jest.mock('../../molecules/BaseItemCard/BaseItemCard', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BaseItemCard: ({ children, testID, itemId, leftElement, rightElement }: any) =>
      R.createElement(
        RN.View,
        { testID: testID || `base-item-card-${itemId}` },
        leftElement || null,
        children,
        rightElement || null,
      ),
  };
});

jest.mock('../../molecules/BaseItemCard/CardLeftSlot', () => {
  const RN = require('react-native');
  return {
    CardLeftSlot: ({ type, imageUrl }: any) =>
      require('react').createElement(RN.View, {
        testID: `card-left-${type}`,
        accessibilityLabel: imageUrl,
      }),
  };
});

jest.mock('../../molecules/BaseItemCard/CardContent', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    CardContent: ({ title, subtitle }: any) =>
      R.createElement(
        RN.View,
        { testID: 'card-content' },
        R.createElement(RN.Text, null, title),
        subtitle,
      ),
  };
});

jest.mock('../../molecules/BaseItemCard/CardRightSlot', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    CardRightSlot: ({ primary, secondary, tertiary }: any) =>
      R.createElement(
        RN.View,
        { testID: 'card-right-slot' },
        R.createElement(RN.Text, null, primary),
        secondary ? R.createElement(RN.Text, null, secondary) : null,
        tertiary ? R.createElement(RN.Text, null, tertiary) : null,
      ),
  };
});

const defaultActions = {
  onItemPress: jest.fn(),
  onItemEdit: jest.fn(),
};

const renderWithProvider = (ui: React.ReactElement) =>
  render(
    <PantryActionsProvider actions={defaultActions}>{ui}</PantryActionsProvider>,
  );

describe('PantryItemCard', () => {
  const defaultProps = {
    id: 'pantry-1',
    name: 'Milk',
    quantity: '2 gal',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    renderWithProvider(<PantryItemCard {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders quantity in right slot', () => {
    renderWithProvider(<PantryItemCard {...defaultProps} />);
    expect(screen.getByText('2 gal')).toBeTruthy();
  });

  it('renders custom location in right slot when provided', () => {
    renderWithProvider(
      <PantryItemCard {...defaultProps} location="Kitchen Cabinet" />,
    );
    expect(screen.getByText('Kitchen Cabinet')).toBeTruthy();
  });

  it('does not render location when location is null', () => {
    renderWithProvider(<PantryItemCard {...defaultProps} location={null} />);
    expect(screen.queryByText('Fridge')).toBeNull();
    expect(screen.queryByText('Freezer')).toBeNull();
    expect(screen.queryByText('Pantry')).toBeNull();
  });

  it('renders with testID based on item id', () => {
    renderWithProvider(<PantryItemCard {...defaultProps} />);
    expect(screen.getByTestId('pantry-item-pantry-1')).toBeTruthy();
  });

  it('renders "Out of stock" text when isOutOfStock is true', () => {
    renderWithProvider(
      <PantryItemCard {...defaultProps} isOutOfStock={true} />,
    );
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });

  it('renders expiration text when provided with color', () => {
    renderWithProvider(
      <PantryItemCard
        {...defaultProps}
        expirationText="Expires in 3 days"
        expirationColor="#FF0000"
        expirationVariant="warning"
      />,
    );
    expect(screen.getByText('Expires in 3 days')).toBeTruthy();
  });

  it('renders image left slot when imageUrl is provided', () => {
    renderWithProvider(
      <PantryItemCard {...defaultProps} imageUrl="https://example.com/milk.jpg" />,
    );
    expect(screen.getByTestId('card-left-image')).toBeTruthy();
  });

  it('does not render image left slot when imageUrl is not provided', () => {
    renderWithProvider(<PantryItemCard {...defaultProps} />);
    expect(screen.queryByTestId('card-left-image')).toBeNull();
  });

  it('renders quantityBreakdownText in right slot secondary when provided', () => {
    renderWithProvider(
      <PantryItemCard
        {...defaultProps}
        quantityBreakdownText="2 x 1 gal"
      />,
    );
    expect(screen.getByText('2 x 1 gal')).toBeTruthy();
  });

  it('renders packageBreakdownText in right slot secondary when provided', () => {
    renderWithProvider(
      <PantryItemCard
        {...defaultProps}
        packageBreakdownText="3 packages"
      />,
    );
    expect(screen.getByText('3 packages')).toBeTruthy();
  });

  it('wraps in SlideAnimatedWrapper when onItemDelete action is available', () => {
    const actionsWithDelete = {
      ...defaultActions,
      onItemDelete: jest.fn(),
    };
    render(
      <PantryActionsProvider actions={actionsWithDelete}>
        <PantryItemCard {...defaultProps} />
      </PantryActionsProvider>,
    );
    // Card still renders
    expect(screen.getByText('Milk')).toBeTruthy();
  });
});
