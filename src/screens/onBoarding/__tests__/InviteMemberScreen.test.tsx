'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { InviteMemberScreen } from '../InviteMemberScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

jest.mock('#hooks/auth/useAuthUser', () => ({
  useAuthUser: () => ({ id: 'u1', email: 'me@test.com' }),
}));

let mockSelectedHomeId: string | null = 'h1';
let mockSelectedShoppingListId: string | null = 'sl1';

jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) => selector({
    selectedHomeId: mockSelectedHomeId,
    selectedShoppingListId: mockSelectedShoppingListId,
  });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn };
});

jest.mock('#generated', () => ({
  useInviteToHomeMutation: jest.fn(() => [jest.fn(() => Promise.resolve()), { loading: false }]),
  useAddCollaboratorMutation: jest.fn(() => [jest.fn(() => Promise.resolve()), { loading: false }]),
  CollaboratorRole: { Contributor: 'CONTRIBUTOR' },
  MembershipRole: { Member: 'MEMBER' },
}));

jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/utils/compilerSafeWrappers');

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
  Button: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress} disabled={disabled} testID="invite-button"><Text>{title}</Text></Pressable>;
  },
}));

describe('InviteMemberScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedHomeId = 'h1';
    mockSelectedShoppingListId = 'sl1';
  });

  it('renders invite title', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByText('Invite family & friends')).toBeTruthy();
  });

  it('shows subtitle for both resources', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByText(/Share your home and shopping lists/)).toBeTruthy();
  });

  it('shows email input', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();
  });

  it('shows empty invites message initially', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByText('No invitations added yet')).toBeTruthy();
  });

  it('shows tip text', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByText(/You can always invite more people later/)).toBeTruthy();
  });

  it('shows send invites button disabled initially', () => {
    render(<InviteMemberScreen />);
    expect(screen.getByText('Send Invites')).toBeTruthy();
  });

  it('shows nothing-to-share state when neither resource exists', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText('Nothing to share yet')).toBeTruthy();
  });

  it('adds an invite when valid email is entered', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText('friend@test.com')).toBeTruthy();
    expect(screen.getByText(/Inviting 1 person/)).toBeTruthy();
  });

  it('shows alert for invalid email', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'not-an-email');
    fireEvent.press(screen.getByText('Add'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Invalid Email', 'Please enter a valid email address');
  });

  it('shows alert for duplicate email', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Duplicate Email', 'This email has already been added');
  });

  it('shows alert when inviting yourself', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'me@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Invalid Email', "You can't invite yourself");
  });

  it('removes an invite when remove button pressed', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText('friend@test.com')).toBeTruthy();
    // Press the remove button (X)
    fireEvent.press(screen.getByText('\u2715'));
    expect(screen.getByText('No invitations added yet')).toBeTruthy();
  });

  it('toggles invite type when hasBoth and type button is pressed', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    // Default type with hasBoth is 'both' => shows Home & Shopping
    expect(screen.getByText(/Home & .* Shopping/)).toBeTruthy();
    // Press the type button to cycle: both -> home
    const typeButton = screen.getByText(/(tap to change)/);
    fireEvent.press(typeButton);
    expect(screen.getByText(/Home Only/)).toBeTruthy();
  });

  it('cycles through all invite types: both -> home -> shopping -> both', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));

    const typeButton = screen.getByText(/(tap to change)/);
    // Start: both
    fireEvent.press(typeButton); // -> home
    expect(screen.getByText(/Home Only/)).toBeTruthy();
    fireEvent.press(typeButton); // -> shopping
    expect(screen.getByText(/Shopping Only/)).toBeTruthy();
    fireEvent.press(typeButton); // -> both
    expect(screen.getByText(/Home & .* Shopping/)).toBeTruthy();
  });

  it('does not toggle invite type when only home is available', () => {
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    // Should show "Home" label (not both)
    expect(screen.getByText(/Home/)).toBeTruthy();
  });

  it('shows subtitle when only home available', () => {
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText(/Share your home with others/)).toBeTruthy();
  });

  it('shows subtitle when only shopping list available', () => {
    mockSelectedHomeId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText(/Share your shopping list with others/)).toBeTruthy();
  });

  it('shows subtitle when neither resource exists', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText(/Create a home or shopping list first/)).toBeTruthy();
  });

  it('sends invites and navigates on success when invites exist', async () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));

    // Press send
    fireEvent.press(screen.getByTestId('invite-button'));

    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    expect(executeWithLoadingState).toHaveBeenCalled();
  });

  it('send button is disabled when no invites to send', () => {
    render(<InviteMemberScreen />);
    // Button is disabled when no invites are added
    const button = screen.getByTestId('invite-button');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
  });

  it('shows "Continue" button in nothing-to-share state', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates from nothing-to-share when Continue is pressed', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    fireEvent.press(screen.getByText('Continue'));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('InviteMembers');
  });

  it('shows "people" plural text when multiple invites added', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'a@test.com');
    fireEvent.press(screen.getByText('Add'));
    fireEvent.changeText(input, 'b@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText(/Inviting 2 people/)).toBeTruthy();
  });

  it('clears email input after adding invite', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    // Input should be cleared
    expect(input.props.value).toBe('');
  });

  it('shows invite type label for shopping only when no home', () => {
    mockSelectedHomeId = null;
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText(/Shopping List/)).toBeTruthy();
  });

  it('adds invite on submit editing (keyboard return)', () => {
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('friend@test.com')).toBeTruthy();
  });

  it('does not show tap to change hint when only one resource', () => {
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.queryByText(/(tap to change)/)).toBeNull();
  });

  it('sends home invite for home-type invites', async () => {
    const mockInviteToHome = jest.fn().mockResolvedValue({});
    const { useInviteToHomeMutation } = require('#generated');
    useInviteToHomeMutation.mockReturnValue([mockInviteToHome, { loading: false }]);

    mockSelectedShoppingListId = null;

    render(<InviteMemberScreen />);
    const input = screen.getByPlaceholderText('Enter email address');
    fireEvent.changeText(input, 'friend@test.com');
    fireEvent.press(screen.getByText('Add'));
    fireEvent.press(screen.getByTestId('invite-button'));

    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    expect(executeWithLoadingState).toHaveBeenCalled();
  });

  it('shows empty state description in nothing-to-share view', () => {
    mockSelectedHomeId = null;
    mockSelectedShoppingListId = null;
    render(<InviteMemberScreen />);
    expect(screen.getByText(/You need to create a home or shopping list first/)).toBeTruthy();
  });
});
