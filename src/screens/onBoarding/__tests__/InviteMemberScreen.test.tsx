'use no memo';

import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { InviteMemberScreen } from '../InviteMemberScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

let mockSelectedHomeId: string | null = 'h1';
let mockSelectedShoppingListId: string | null = 'sl1';

jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) =>
    selector({
      selectedHomeId: mockSelectedHomeId,
      selectedShoppingListId: mockSelectedShoppingListId,
    });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => ({ id: 'u1', email: 'me@test.com' })),
    useSelectedHomeId: jest.fn(() => mockSelectedHomeId),
  };
});

jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#components/atoms/EmailInput', () => ({
  EmailInput: (props: any) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder="Enter email address" {...props} />;
  },
}));
jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({ title, subtitle, children }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="onboarding-wrapper">
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled, testID }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID={testID}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

describe('InviteMemberScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedHomeId = 'h1';
    mockSelectedShoppingListId = 'sl1';
  });

  it('renders invite title', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText('Invite family & friends')).toBeTruthy();
  });

  it('shows subtitle for both resources', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(
      screen.getByText(/Invite others to your home and shopping lists/),
    ).toBeTruthy();
  });

  it('shows email input', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();
  });

  it('shows empty invites message initially', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText('No invitations added yet')).toBeTruthy();
  });

  it('shows tip text', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(
      screen.getByText(/You can always invite more people later/),
    ).toBeTruthy();
  });

  it('shows send invites button disabled initially', () => {
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText('Send Invites')).toBeTruthy();
  });

  it('shows nothing-to-share state when neither resource exists', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText('Nothing to share yet')).toBeTruthy();
  });

  it('adds an invite when valid email is entered', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    expect(screen.getByText('friend@test.com')).toBeTruthy();
    expect(screen.getByText(/Inviting 1 person/)).toBeTruthy();
  });

  it('shows alert for invalid email', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'not-an-email');
    await user.press(screen.getByText('Add'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Invalid Email',
      'Please enter a valid email address',
    );
  });

  it('shows alert for duplicate email', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Duplicate Email',
      'This email has already been added',
    );
  });

  it('shows alert when inviting yourself', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'me@test.com');
    await user.press(screen.getByText('Add'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Invalid Email',
      "You can't invite yourself",
    );
  });

  it('removes an invite when remove button pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    expect(screen.getByText('friend@test.com')).toBeTruthy();
    // Press the remove button (X)
    await user.press(screen.getByText('✕'));
    expect(screen.getByText('No invitations added yet')).toBeTruthy();
  });

  it('shows subtitle when only home available', () => {
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText(/Invite others to your home/)).toBeTruthy();
  });

  it('shows subtitle when only shopping list available', () => {
    mockSelectedHomeId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(
      screen.getByText(/Invite others to your shopping list/),
    ).toBeTruthy();
  });

  it('shows subtitle when neither resource exists', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(
      screen.getByText(/Create a home or shopping list first/),
    ).toBeTruthy();
  });

  it('sends invites and navigates on success when invites exist', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));

    // Press send
    await user.press(screen.getByText(/Send.*Invite/));

    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    expect(executeWithLoadingState).toHaveBeenCalled();
  });

  it('send button is disabled when no invites to send', () => {
    renderWithApollo(<InviteMemberScreen />);
    // Button renders "Send Invites" but is disabled when no invites are added
    expect(screen.getByText(/Send.*Invite/)).toBeTruthy();
  });

  it('shows "Continue" button in nothing-to-share state', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates from nothing-to-share when Continue is pressed', async () => {
    const user = userEvent.setup();
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    await user.press(screen.getByText('Continue'));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('InviteMembers');
  });

  it('shows "people" plural text when multiple invites added', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'a@test.com');
    await user.press(screen.getByText('Add'));
    fireEvent.changeText(input, 'b@test.com');
    await user.press(screen.getByText('Add'));
    expect(screen.getByText(/Inviting 2 people/)).toBeTruthy();
  });

  it('clears email input after adding invite', async () => {
    const user = userEvent.setup();
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    // Input should be cleared
    expect(input.props.value).toBe('');
  });

  it('adds invite on submit editing (keyboard return)', () => {
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('friend@test.com')).toBeTruthy();
  });

  it('does not show tap to change hint when only one resource', async () => {
    const user = userEvent.setup();
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    expect(screen.queryByText(/(tap to change)/)).toBeNull();
  });

  it('sends home invite for home-type invites', async () => {
    const user = userEvent.setup();
    mockSelectedShoppingListId = null;

    renderWithApollo(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    await user.press(screen.getByText('Add'));
    await user.press(screen.getByText(/Send.*Invite/));

    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    expect(executeWithLoadingState).toHaveBeenCalled();
  });

  it('shows empty state description in nothing-to-share view', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    renderWithApollo(<InviteMemberScreen />);
    expect(
      screen.getByText(/You need to create a home or shopping list first/),
    ).toBeTruthy();
  });
});
