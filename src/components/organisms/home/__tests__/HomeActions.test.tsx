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

  // Regression: the chips used to size to their labels and sit BESIDE them, so
  // sq "Vendos si parazgjedhur" / es "Establecer Predeterminado" made the chip
  // wider than a third of the card and pushed Delete onto a second row. The
  // label is stacked under the icon now, so each button is a fixed third and
  // the label wraps into the button's full width instead of widening it. Jest
  // has no Yoga layout pass, so this asserts the style contract that guarantees
  // it; confirm the wrap on device.
  it('stacks each label under its icon in an equal-width third of one row', () => {
    render(<HomeActions {...defaultProps} />);

    for (const label of ['Set Default', 'Invite', 'Delete']) {
      const text = screen.getByText(label);
      expect(text.props.numberOfLines).toBe(2);

      const button = StyleSheet.flatten(
        screen.getByRole('button', { name: label }).props.style,
      );
      expect(button.flex).toBe(1);
      expect(button.flexDirection).toBe('column');
    }
  });
});
