import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';

describe('SectionHeader', () => {
  it('renders title text', () => {
    render(<SectionHeader title="EXPIRING SOON" />);
    expect(screen.getByText('EXPIRING SOON')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const { toJSON } = render(<SectionHeader title="EXPIRING SOON" icon="!" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('!');
  });

  it('does not render icon text node when not provided', () => {
    render(<SectionHeader title="ITEMS" />);
    // Only one text element with the title should be in the left content
    expect(screen.getAllByText(/ITEMS/)).toHaveLength(1);
  });

  it('appends count in parentheses', () => {
    render(<SectionHeader title="ITEMS" count={5} />);
    expect(screen.getByText('ITEMS (5)')).toBeTruthy();
  });

  it('does not append count when undefined', () => {
    render(<SectionHeader title="ITEMS" />);
    expect(screen.getByText('ITEMS')).toBeTruthy();
  });

  it('renders action label when provided', () => {
    const onActionPress = jest.fn();
    render(
      <SectionHeader
        title="ITEMS"
        actionLabel="Sort"
        onActionPress={onActionPress}
      />,
    );
    expect(screen.getByText('Sort')).toBeTruthy();
  });

  it('fires onActionPress when action button is pressed', () => {
    const onActionPress = jest.fn();
    render(
      <SectionHeader
        title="ITEMS"
        actionLabel="Sort"
        onActionPress={onActionPress}
      />,
    );
    fireEvent.press(screen.getByText('Sort'));
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only actionLabel is provided without onActionPress', () => {
    render(<SectionHeader title="ITEMS" actionLabel="Sort" />);
    expect(screen.queryByText('Sort')).toBeNull();
  });

  it('applies testID to container', () => {
    render(<SectionHeader title="ITEMS" testID="section-header" />);
    expect(screen.getByTestId('section-header')).toBeTruthy();
  });
});
