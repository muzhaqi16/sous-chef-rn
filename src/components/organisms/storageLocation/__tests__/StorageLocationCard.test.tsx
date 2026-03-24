'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StorageLocationCard } from '../StorageLocationCard';

jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, `icon-${name}`);
  },
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    card: {},
    shadow: {},
    row: {},
    rowSpaceBetween: {},
    title: {},
    badge: {},
    badgeText: {},
    caption: {},
  },
}));

describe('StorageLocationCard', () => {
  const defaultLocation = {
    name: 'Kitchen Fridge',
    type: 'REFRIGERATOR',
    icon: '🧊',
    currentItemCount: 12,
    parentLocation: null,
  };

  const defaultProps = {
    location: defaultLocation,
    isDefault: false,
    onPress: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onSetDefault: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders location name', () => {
    render(<StorageLocationCard {...defaultProps} />);
    expect(screen.getByText('Kitchen Fridge')).toBeTruthy();
  });

  it('renders SVG icon for storage type', () => {
    const { UNSAFE_queryByType } = render(
      <StorageLocationCard {...defaultProps} />,
    );
    const {
      StorageLocationIcon,
    } = require('#components/atoms/StorageLocationIcon');
    expect(UNSAFE_queryByType(StorageLocationIcon)).toBeTruthy();
  });

  it('renders item count with correct pluralization', () => {
    render(<StorageLocationCard {...defaultProps} />);
    expect(screen.getByText(/12 items/)).toBeTruthy();
  });

  it('renders singular item for count of 1', () => {
    render(
      <StorageLocationCard
        {...defaultProps}
        location={{ ...defaultLocation, currentItemCount: 1 }}
      />,
    );
    expect(screen.getByText(/1 item/)).toBeTruthy();
  });

  it('renders Default badge when isDefault is true', () => {
    render(<StorageLocationCard {...defaultProps} isDefault={true} />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders Set Default button when not default', () => {
    render(<StorageLocationCard {...defaultProps} />);
    expect(screen.getByText('Set Default')).toBeTruthy();
  });

  it('hides Set Default button when isDefault', () => {
    render(<StorageLocationCard {...defaultProps} isDefault={true} />);
    expect(screen.queryByText('Set Default')).toBeNull();
  });

  it('renders Edit and Delete buttons', () => {
    render(<StorageLocationCard {...defaultProps} />);
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('calls onEdit when Edit is pressed', () => {
    render(<StorageLocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText('Edit'));
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('calls onDelete when Delete is pressed', () => {
    render(<StorageLocationCard {...defaultProps} />);
    fireEvent.press(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });
});
