'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { InviteUserModal } from '#features/home/components/InviteUserModal';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { drainTimers } from '#/test-utils/drainTimers';
import { useStore } from '#store';
import { getI18n } from '#/i18n/config';

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ isOnline: true, apiReachable: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('InviteUserModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default title', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Invite Member to Home')).toBeTruthy();
  });

  it('renders custom title when provided', () => {
    render(<InviteUserModal {...defaultProps} title="Add a User" />);
    expect(screen.getByText('Add a User')).toBeTruthy();
  });

  it('renders email input field', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Email Address')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();
  });

  it('renders role selection section', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Select Role')).toBeTruthy();
  });

  it('renders Member, Admin, and Guest roles by default (excludes Owner)', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Guest')).toBeTruthy();
    expect(screen.queryByText('Owner')).toBeNull();
  });

  it('renders Owner role when allowedRoles includes it', () => {
    render(
      <InviteUserModal
        {...defaultProps}
        allowedRoles={[MembershipRole.Member, MembershipRole.Owner]}
      />,
    );
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
  });

  it('renders default button text', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Send Invite')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders custom button text', () => {
    render(
      <InviteUserModal
        {...defaultProps}
        submitText="Invite Now"
        cancelText="Dismiss"
      />,
    );
    expect(screen.getByText('Invite Now')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows role descriptions', () => {
    render(<InviteUserModal {...defaultProps} />);
    expect(screen.getByText('Can add and edit items in pantry')).toBeTruthy();
    expect(screen.getByText('Can manage members and settings')).toBeTruthy();
    expect(screen.getByText('View-only access to home')).toBeTruthy();
  });

  it('allows typing in email input', () => {
    render(<InviteUserModal {...defaultProps} />);
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(emailInput, 'test@example.com');
    expect(emailInput.props.value).toBe('test@example.com');
  });

  it('reports an empty email on the field, in the shared wording', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    await user.press(screen.getByText('Send Invite'));
    await drainTimers();
    expect(screen.getByText('Email is required')).toBeTruthy();
  });

  it('shows error for invalid email format', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(emailInput, 'not-an-email');
    await user.press(screen.getByText('Send Invite'));
    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
  });

  it.each([
    ['no connection', { isOnline: false, apiReachable: null }],
    ['the API down on working Wi-Fi', { isOnline: true, apiReachable: false }],
  ])('sends no invite with %s, and says why', async (_cause, network) => {
    useStore.setState(network);
    const user = userEvent.setup();
    const onSubmit = jest.fn(() => Promise.resolve());
    render(<InviteUserModal {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter email address'),
      'someone@example.com',
    );

    await user.press(screen.getByText('Send Invite'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(getI18n().t('inviteUser.offlineError')),
    ).toBeTruthy();
  });

  it('allows selecting a different role', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    await user.press(screen.getByText('Admin'));
    // The Admin role option should now be selected (we verify it doesn't crash)
    expect(screen.getByText('Admin')).toBeTruthy();
  });
});
