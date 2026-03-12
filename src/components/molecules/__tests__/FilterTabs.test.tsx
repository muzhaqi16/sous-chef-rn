import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FilterTabs } from '../FilterTabs/FilterTabs';

describe('FilterTabs', () => {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'fridge', label: 'Fridge' },
    { id: 'freezer', label: 'Freezer' },
  ];

  const defaultProps: any = {
    tabs,
    activeTabId: 'all',
    onTabChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all tab labels', () => {
    render(<FilterTabs {...defaultProps} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Fridge')).toBeTruthy();
    expect(screen.getByText('Freezer')).toBeTruthy();
  });

  it('calls onTabChange when a tab is pressed', () => {
    render(<FilterTabs {...defaultProps} />);
    fireEvent.press(screen.getByTestId('filter-tab-fridge'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('fridge');
  });

  it('renders testIDs with prefix', () => {
    render(<FilterTabs {...defaultProps} testIDPrefix="location" />);
    expect(screen.getByTestId('location-all')).toBeTruthy();
    expect(screen.getByTestId('location-fridge')).toBeTruthy();
    expect(screen.getByTestId('location-freezer')).toBeTruthy();
  });

  it('renders count badges when counts are provided', () => {
    render(
      <FilterTabs
        {...defaultProps}
        counts={{ all: 10, fridge: 3, freezer: 2 }}
      />,
    );
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('does not render counts when showCounts is false', () => {
    render(
      <FilterTabs
        {...defaultProps}
        counts={{ all: 10, fridge: 3 }}
        showCounts={false}
      />,
    );
    expect(screen.queryByText('10')).toBeNull();
    expect(screen.queryByText('3')).toBeNull();
  });

  it('renders action button when provided', () => {
    const onAction = jest.fn();
    render(
      <FilterTabs
        {...defaultProps}
        actionButton={{
          label: 'Add',
          onPress: onAction,
          testID: 'add-action',
        }}
      />,
    );
    expect(screen.getByTestId('add-action')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('calls action button onPress when pressed', () => {
    const onAction = jest.fn();
    render(
      <FilterTabs
        {...defaultProps}
        actionButton={{
          label: 'Add',
          onPress: onAction,
          testID: 'add-action',
        }}
      />,
    );
    fireEvent.press(screen.getByTestId('add-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('uses custom tab onPress when provided instead of onTabChange', () => {
    const customPress = jest.fn();
    const tabsWithAction = [
      { id: 'all', label: 'All' },
      { id: 'custom', label: 'Custom', onPress: customPress },
    ];

    render(
      <FilterTabs
        tabs={tabsWithAction as any}
        activeTabId="all"
        onTabChange={defaultProps.onTabChange}
      />,
    );
    fireEvent.press(screen.getByTestId('filter-tab-custom'));
    expect(customPress).toHaveBeenCalledTimes(1);
    expect(defaultProps.onTabChange).not.toHaveBeenCalled();
  });
});
