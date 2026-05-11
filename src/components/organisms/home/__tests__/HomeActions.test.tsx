import React from 'react';
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
});
