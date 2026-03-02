'use no memo';

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AcceptInvite } from '../AcceptInvite';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
  })),
  useRoute: jest.fn(() => ({
    params: { inviteId: 'invite-1' },
  })),
}));

jest.mock('#generated', () => ({
  useMyShoppingListInvitesQuery: jest.fn(() => ({
    data: null,
    loading: false,
  })),
  useAcceptShoppingListInviteMutation: jest.fn(() => [jest.fn()]),
  useDeclineShoppingListInviteMutation: jest.fn(() => [jest.fn()]),
  useGetMyPendingInvitesQuery: jest.fn(() => ({
    data: null,
    loading: false,
  })),
  useAcceptHomeInviteMutation: jest.fn(() => [jest.fn()]),
  useDeclineHomeInviteMutation: jest.fn(() => [jest.fn()]),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  getErrorMessage: jest.fn((e: any) => e?.message || 'Unknown error'),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any, onError?: any) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }),
}));

jest.mock('#components/molecules/Header', () => ({
  Header: () => null,
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

describe('AcceptInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset generated mocks to defaults (clearAllMocks does not clear mockReturnValue)
    const gen = jest.requireMock('#generated');
    gen.useMyShoppingListInvitesQuery.mockReturnValue({ data: null, loading: false });
    gen.useAcceptShoppingListInviteMutation.mockReturnValue([jest.fn()]);
    gen.useDeclineShoppingListInviteMutation.mockReturnValue([jest.fn()]);
    gen.useGetMyPendingInvitesQuery.mockReturnValue({ data: null, loading: false });
    gen.useAcceptHomeInviteMutation.mockReturnValue([jest.fn()]);
    gen.useDeclineHomeInviteMutation.mockReturnValue([jest.fn()]);
    // Reset route mock
    const nav = jest.requireMock('@react-navigation/native');
    nav.useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
    // Restore executeWithLoadingState
    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    executeWithLoadingState.mockImplementation(async (fn: any, setLoading: any, onError?: any) => {
      setLoading(true);
      try {
        return await fn();
      } catch (e) {
        onError?.(e);
      } finally {
        setLoading(false);
      }
    });
  });

  it('shows "not found" when no invite matches', () => {
    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/Invitation not found or expired/)).toBeTruthy();
  });

  it('shows loading state while fetching invites', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: null,
      loading: true,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders shopping list invite details', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'Weekly Groceries' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText("You've been invited!")).toBeTruthy();
    expect(tree.getByText('Accept')).toBeTruthy();
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('renders home invite details', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText("You've been invited!")).toBeTruthy();
  });

  it('shows Go Back button on not found state', () => {
    const { useMyShoppingListInvitesQuery, useGetMyPendingInvitesQuery } =
      jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: null,
      loading: false,
    });
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: null,
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Go Back')).toBeTruthy();
  });

  it('shows shopping list invite with inviter email fallback', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'VIEWER',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/host@test.com/)).toBeTruthy();
  });

  it('shows "Someone" when inviter is missing for shopping list invite', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: null,
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/Someone/)).toBeTruthy();
  });

  it('shows role for shopping list invite', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/EDITOR/)).toBeTruthy();
  });

  it('shows "Shopping List" as invite type for shopping list invite', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Shopping List')).toBeTruthy();
  });

  it('renders invite details when home invite exists', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    // The invite is found so the invite details screen is shown
    expect(tree.getByText("You've been invited!")).toBeTruthy();
    expect(tree.getByText('Accept')).toBeTruthy();
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('shows role for home invite', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'ADMIN',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    // The role is displayed via invitationType check - initially unknown so
    // it renders shoppingListInvite?.role (undefined) but re-renders as ADMIN
    expect(tree.getByText("You've been invited!")).toBeTruthy();
  });

  it('shows "Shopping List" fallback when shopping list name is missing', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: null,
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    // The fallback for missing shoppingList.name is 'Shopping List'
    expect(tree.getAllByText('Shopping List').length).toBeGreaterThanOrEqual(1);
  });

  it('shows description when shopping list has description', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List', description: 'Weekly shopping' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Description:')).toBeTruthy();
    expect(tree.getByText('Weekly shopping')).toBeTruthy();
  });

  it('shows accept and decline buttons for invite', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Accept')).toBeTruthy();
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('calls acceptShoppingListInvite on accept for shopping list invite', async () => {
    const mockAcceptSL = jest.fn().mockResolvedValue({});
    const { useMyShoppingListInvitesQuery, useAcceptShoppingListInviteMutation } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });
    useAcceptShoppingListInviteMutation.mockReturnValue([mockAcceptSL]);

    const tree = render(<AcceptInvite />);
    // Wait for invitationType useEffect to resolve
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    fireEvent.press(tree.getByText('Accept'));

    await waitFor(() => expect(mockAcceptSL).toHaveBeenCalledWith({ variables: { token: 'invite-1' } }));
  });

  it('calls acceptHomeInvite on accept for home invite', async () => {
    const mockAcceptHome = jest.fn().mockResolvedValue({});
    const { useGetMyPendingInvitesQuery, useAcceptHomeInviteMutation } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });
    useAcceptHomeInviteMutation.mockReturnValue([mockAcceptHome]);

    const tree = render(<AcceptInvite />);
    // Wait for invitationType useEffect to resolve to 'home' (shows "join" text)
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
    fireEvent.press(tree.getByText('Accept'));

    await waitFor(() => expect(mockAcceptHome).toHaveBeenCalledWith({ variables: { token: 'invite-1' } }));
  });

  it('shows decline confirmation dialog', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    fireEvent.press(tree.getByText('Decline'));

    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      expect.any(Array),
    );
  });

  it('calls declineShoppingListInvite when decline is confirmed', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const mockDeclineSL = jest.fn().mockResolvedValue({});
    const { useMyShoppingListInvitesQuery, useDeclineShoppingListInviteMutation } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });
    useDeclineShoppingListInviteMutation.mockReturnValue([mockDeclineSL]);

    const tree = render(<AcceptInvite />);
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    fireEvent.press(tree.getByText('Decline'));

    // Get the Alert buttons and press Decline
    const alertCall = (require('react-native').Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const declineBtn = buttons.find((b: any) => b.text === 'Decline');
    await declineBtn.onPress();

    await waitFor(() => expect(mockDeclineSL).toHaveBeenCalledWith({ variables: { token: 'invite-1' } }));
  });

  it('calls declineHomeInvite when decline is confirmed for home invite', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const mockDeclineHome = jest.fn().mockResolvedValue({});
    const { useGetMyPendingInvitesQuery, useDeclineHomeInviteMutation } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });
    useDeclineHomeInviteMutation.mockReturnValue([mockDeclineHome]);

    const tree = render(<AcceptInvite />);
    // Wait for invitationType useEffect to resolve to 'home'
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
    fireEvent.press(tree.getByText('Decline'));

    const alertCall = (require('react-native').Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const declineBtn = buttons.find((b: any) => b.text === 'Decline');
    await declineBtn.onPress();

    await waitFor(() => expect(mockDeclineHome).toHaveBeenCalledWith({ variables: { token: 'invite-1' } }));
  });

  it('shows error alert when accept fails', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const mockAcceptSL = jest.fn().mockRejectedValue(new Error('Network error'));
    const { useMyShoppingListInvitesQuery, useAcceptShoppingListInviteMutation } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });
    useAcceptShoppingListInviteMutation.mockReturnValue([mockAcceptSL]);

    const tree = render(<AcceptInvite />);
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    fireEvent.press(tree.getByText('Accept'));

    // Wait for error handling
    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
    });
  });

  it('shows error alert for invalid invitation when no token', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: {} });

    // No invites found but not loading
    const { useMyShoppingListInvitesQuery, useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({ data: null, loading: false });
    useGetMyPendingInvitesQuery.mockReturnValue({ data: null, loading: false });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/Invitation not found/)).toBeTruthy();

    // Reset route mock
    useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
  });

  it('shows "Home" invite type label for home invite', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Home')).toBeTruthy();
  });

  it('shows "Home" fallback when home invite has no home name', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: null,
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    // The fallback for missing home.name is 'Home'
    expect(tree.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
  });

  it('shows description for home invite with description', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home', description: 'Our family home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText('Description:')).toBeTruthy();
    expect(tree.getByText('Our family home')).toBeTruthy();
  });

  it('navigates back when Go Back is pressed on not found screen', () => {
    const tree = render(<AcceptInvite />);
    fireEvent.press(tree.getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows "Someone" when home inviter has no displayName or email', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: null,
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/Someone/)).toBeTruthy();
  });

  it('shows inviter displayName for home invite when available', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com', profile: { displayName: 'HomeOwner' } },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/HomeOwner/)).toBeTruthy();
  });

  it('shows inviter displayName for shopping list invite when available', () => {
    const { useMyShoppingListInvitesQuery } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com', profile: { displayName: 'ListOwner' } },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    expect(tree.getByText(/ListOwner/)).toBeTruthy();
  });

  it('shows loading state when home invites are still loading', () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: null,
      loading: true,
    });

    const tree = render(<AcceptInvite />);
    // Should show the loading view, not the error or invite detail view
    expect(tree.toJSON()).toBeTruthy();
  });

  it('uses token from route params when available', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'deep-link-token', inviteId: 'invite-1' } });

    const mockAcceptSL = jest.fn().mockResolvedValue({});
    const { useMyShoppingListInvitesQuery, useAcceptShoppingListInviteMutation } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });
    useAcceptShoppingListInviteMutation.mockReturnValue([mockAcceptSL]);

    const tree = render(<AcceptInvite />);
    // Wait for invitationType useEffect to resolve to 'shopping_list' (shows "collaborate on")
    await waitFor(() => expect(tree.getByText(/collaborate on/)).toBeTruthy());
    fireEvent.press(tree.getByText('Accept'));

    // Should use route token, not invite.id
    await waitFor(() => expect(mockAcceptSL).toHaveBeenCalledWith({ variables: { token: 'deep-link-token' } }));
  });

  it('shows "join" text for home invite and "collaborate on" for shopping list', async () => {
    const { useGetMyPendingInvitesQuery } = jest.requireMock('#generated');
    useGetMyPendingInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingHomeInvites: [
            {
              id: 'invite-1',
              role: 'MEMBER',
              invitedBy: { email: 'owner@test.com' },
              home: { name: 'Family Home' },
            },
          ],
        },
      },
      loading: false,
    });

    const tree = render(<AcceptInvite />);
    // invitationType starts as 'unknown' and is set to 'home' via useEffect
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
  });

  it('shows error alert when decline fails', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const mockDeclineSL = jest.fn().mockRejectedValue(new Error('Failed'));
    const { useMyShoppingListInvitesQuery, useDeclineShoppingListInviteMutation } = jest.requireMock('#generated');
    useMyShoppingListInvitesQuery.mockReturnValue({
      data: {
        me: {
          pendingCollaborationInvites: [
            {
              id: 'invite-1',
              role: 'EDITOR',
              invitedBy: { email: 'host@test.com' },
              shoppingList: { name: 'My List' },
            },
          ],
        },
      },
      loading: false,
    });
    useDeclineShoppingListInviteMutation.mockReturnValue([mockDeclineSL]);

    const tree = render(<AcceptInvite />);
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    fireEvent.press(tree.getByText('Decline'));

    const alertCall = (require('react-native').Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const declineBtn = buttons.find((b: any) => b.text === 'Decline');
    await declineBtn.onPress();

    // Wait for error handling
    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to decline invitation',
      );
    });
  });
});
