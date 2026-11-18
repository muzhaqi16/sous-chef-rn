import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { render, screen, userEvent } from '@testing-library/react-native';
import { HomeActions } from '../HomeActions';

jest.mock('#components/atoms/Icon', () => ({
  Icon: 'Icon',
}));

describe('HomeActions', () => {
  const defaultProps = {
    homeId: 'home-1',
    onInvite: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders nothing when it may neither invite nor delete', () => {
    render(
      <HomeActions {...defaultProps} canInvite={false} canDelete={false} />,
    );
    expect(screen.queryByText('Invite')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('hides "Delete" button when canDelete is false', () => {
    render(<HomeActions {...defaultProps} canDelete={false} />);
    expect(screen.queryByText('Delete')).toBeNull();
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

  // Pins: a chip sizes to the row, not to its label, so a long translation
  // wraps under its icon instead of pushing the next chip onto a second row.
  // Jest has no Yoga layout pass, so this asserts the style contract that
  // guarantees it; confirm the wrap on device.
  it('stacks each label under its icon in an equal-width share of one row', () => {
    render(<HomeActions {...defaultProps} />);

    for (const label of ['Invite', 'Delete']) {
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
