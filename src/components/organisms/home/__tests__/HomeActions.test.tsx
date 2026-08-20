import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { render, screen, userEvent } from '@testing-library/react-native';
import { HomeActions } from '../HomeActions';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

describe('HomeActions', () => {
  const defaultProps = {
    homeId: 'home-1',
    isDefault: false,
    onSetDefault: jest.fn(),
    onInvite: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Set Default" button when not default', () => {
    render(<HomeActions {...defaultProps} />);
    expect(screen.getByText('Set Default')).toBeTruthy();
  });

  it('does not render "Set Default" when isDefault is true', () => {
    render(<HomeActions {...defaultProps} isDefault={true} />);
    expect(screen.queryByText('Set Default')).toBeNull();
  });

  it('renders "Invite" button by default', () => {
    render(<HomeActions {...defaultProps} />);
    expect(screen.getByText('Invite')).toBeTruthy();
  });

  it('hides "Invite" button when canInvite is false', () => {
    render(<HomeActions {...defaultProps} canInvite={false} />);
    expect(screen.queryByText('Invite')).toBeNull();
  });

  it('renders "Delete" button by default', () => {
    render(<HomeActions {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides "Delete" button when canDelete is false', () => {
    render(<HomeActions {...defaultProps} canDelete={false} />);
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('calls onSetDefault with homeId when pressed', async () => {
    const user = userEvent.setup();
    render(<HomeActions {...defaultProps} />);
    await user.press(screen.getByText('Set Default'));
    expect(defaultProps.onSetDefault).toHaveBeenCalledWith('home-1');
  });

  it('calls onInvite with homeId when pressed', async () => {
    const user = userEvent.setup();
    render(<HomeActions {...defaultProps} />);
    await user.press(screen.getByText('Invite'));
    expect(defaultProps.onInvite).toHaveBeenCalledWith('home-1');
  });

  it('calls onDelete with homeId when pressed', async () => {
    const user = userEvent.setup();
    render(<HomeActions {...defaultProps} />);
    await user.press(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('home-1');
  });

  // Regression: the row used to be a plain `flexDirection: 'row'` with no
  // flexWrap and no flexShrink on the chips (Yoga defaults flexShrink to 0), so
  // a long label — sq "Vendos si parazgjedhur" for cardSetDefault — pushed the
  // Delete chip off the right edge of the screen. Jest has no Yoga layout pass,
  // so these assert the style contract that makes wrapping possible; the actual
  // wrap has to be confirmed on device.
  it('wraps the action row instead of overflowing with long labels', () => {
    render(<HomeActions {...defaultProps} />);
    const row = StyleSheet.flatten(
      screen.getByTestId('home-actions').props.style,
    );
    expect(row.flexWrap).toBe('wrap');
  });

  it('lets each action label shrink and wrap', () => {
    render(<HomeActions {...defaultProps} />);
    for (const label of ['Set Default', 'Invite', 'Delete']) {
      const text = screen.getByText(label);
      expect(text.props.numberOfLines).toBe(2);
      expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1);
    }
  });
});
