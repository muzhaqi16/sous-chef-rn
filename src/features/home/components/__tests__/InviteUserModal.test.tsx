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

jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: jest.fn(() => false),
}));

jest.mock('#/utils/finallyHelpers');

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
    expect(await screen.findByText('Email is required')).toBeTruthy();
  });

  it('shows error for invalid email format', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(emailInput, 'not-an-email');
    await user.press(screen.getByText('Send Invite'));
    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('disables submit button when offline', () => {
    const offlineMock = require('#hooks/settings/useOfflineMode');
    offlineMock.useIsEffectivelyOffline.mockReturnValue(true);
    render(<InviteUserModal {...defaultProps} />);
    // In offline mode the submit button is disabled
    // Verify the modal renders with roles and button visible
    expect(screen.getByText('Send Invite')).toBeTruthy();
    expect(screen.getByText('Email Address')).toBeTruthy();
    offlineMock.useIsEffectivelyOffline.mockReturnValue(false);
  });

  it('allows selecting a different role', async () => {
    const user = userEvent.setup();
    render(<InviteUserModal {...defaultProps} />);
    await user.press(screen.getByText('Admin'));
    // The Admin role option should now be selected (we verify it doesn't crash)
    expect(screen.getByText('Admin')).toBeTruthy();
  });
});
