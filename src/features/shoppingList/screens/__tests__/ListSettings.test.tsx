'use no memo';

import React from 'react';
import type { TextInputProps } from 'react-native';
import { screen, fireEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import type { InfoRowProps } from '#components/molecules/InfoRow';
import { ListSettings } from '../ListSettings';

const render = (ui: React.ReactElement) => renderWithApollo(ui);

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const fn = <T,>(
    selector: (state: { setSelectedShoppingListId: () => void }) => T,
  ): T =>
    selector({
      setSelectedShoppingListId: jest.fn(),
    });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => ({ id: 'u1', email: 'test@test.com' })),
  };
});

jest.mock('#features/shoppingList/hooks/useShoppingListDetails', () => ({
  useShoppingListDetails: () => ({
    shoppingList: {
      id: 'sl1',
      name: 'Weekly Groceries',
      isDefault: true,
      homeId: null,
      home: null,
      createdBy: { id: 'u1' },
      collaboratorsConnection: { edges: [], totalCount: 0 },
    },
    isShared: false,
    collaborators: [],
  }),
}));

jest.mock('#/hooks/home/useLazyHomeData', () => ({
  useLazyHomeData: () => ({
    homes: [],
    fetchHomeData: jest.fn(),
    isLoaded: false,
  }),
}));

jest.mock('#features/shoppingList/hooks/useShoppingListsQuery', () => ({
  useShoppingListsQuery: () => ({ lists: [] }),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'err' })),
  }),
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));
jest.mock('#/utils/compilerSafeWrappers');
jest.mock('#utils/ownershipHelpers', () => ({
  isShoppingListOwner: jest.fn(() => true),
  getShoppingListRole: jest.fn(() => 'OWNER'),
  formatRoleDisplay: jest.fn(() => 'Owner'),
  getShoppingListOwnerInfo: jest.fn(() => null),
}));

jest.mock('#components/molecules/ScreenHeader', () => ({
  ScreenHeader: ({
    title,
    rightElement,
  }: {
    title: string;
    rightElement?: React.ReactNode;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="screen-header">
        <Text>{title}</Text>
        {rightElement}
      </View>
    );
  },
}));
jest.mock('#components/molecules/InfoRow', () => ({
  InfoRow: ({ label, value }: Pick<InfoRowProps, 'label' | 'value'>) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </View>
    );
  },
}));
jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: () => null,
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: ({ label, ...props }: { label?: string } & TextInputProps) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput {...props} />
      </View>
    );
  },
}));
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    settingsSection: {},
    settingsSectionTitle: {},
    settingsInputGroup: {},
    settingsLabel: {},
    settingsRow: {},
    settingsRowInfo: {},
    settingsRowLabel: {},
    settingsRowDescription: {},
  },
}));

describe('ListSettings', () => {
  const editRoute = { params: { listId: 'sl1' } };
  const createRoute = { params: undefined };

  beforeEach(() => jest.clearAllMocks());

  it('renders settings title when editing as owner', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('List Settings')).toBeTruthy();
  });

  it('renders create title when creating', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.getByText('Create New List')).toBeTruthy();
  });

  it('shows list name input area', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('List Name')).toBeTruthy();
  });

  it('shows default list toggle', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Default List')).toBeTruthy();
  });

  it('shows sharing section when editing as owner', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(screen.getByText('Manage Members')).toBeTruthy();
  });

  it('shows danger zone when editing as owner', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Delete List')).toBeTruthy();
  });

  it('hides danger zone when creating', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });

  it('shows Save button for editing', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('shows Create button when creating new list', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('hides sharing section when creating', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.queryByText('Sharing')).toBeNull();
  });

  it('shows "Link to Home" option when creating new list', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.getByText('Link to Home (Optional)')).toBeTruthy();
  });

  it('hides "Link to Home" when editing', () => {
    render(<ListSettings route={editRoute} />);
    expect(screen.queryByText('Link to Home (Optional)')).toBeNull();
  });

  it('shows read-only view for non-owner collaborator', () => {
    const { isShoppingListOwner } = require('#utils/ownershipHelpers');
    isShoppingListOwner.mockReturnValue(false);

    const { getShoppingListRole } = require('#utils/ownershipHelpers');
    getShoppingListRole.mockReturnValue('EDITOR');

    const { formatRoleDisplay } = require('#utils/ownershipHelpers');
    formatRoleDisplay.mockReturnValue('Editor');

    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('List Info')).toBeTruthy();
    expect(screen.getByText('List Information')).toBeTruthy();
  });

  it('shows role display for non-owner', () => {
    const {
      isShoppingListOwner,
      getShoppingListRole,
      formatRoleDisplay,
    } = require('#utils/ownershipHelpers');
    isShoppingListOwner.mockReturnValue(false);
    getShoppingListRole.mockReturnValue('EDITOR');
    formatRoleDisplay.mockReturnValue('Editor');

    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Your Role')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('shows Leave List section for non-owner collaborator', () => {
    const ownerHelpers = require('#utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(false);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: true,
        homeId: null,
        home: null,
        createdBy: { id: 'u2' },
        collaboratorsConnection: { edges: [], totalCount: 0 },
      },
      isShared: false,
      collaborators: [
        { id: 'c1', email: 'test@test.com', collaboratorId: 'u1' },
      ],
    }));

    render(<ListSettings route={editRoute} />);
    expect(screen.getAllByText('Leave List').length).toBeGreaterThanOrEqual(1);
  });

  it('shows disabled Leave List when list is home-linked for non-owner', () => {
    const ownerHelpers = require('#utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(false);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: true,
        homeId: 'h1',
        home: {
          name: 'Family Home',
          myMembership: { id: 'm1', role: 'MEMBER' },
        },
        createdBy: { id: 'u2' },
        collaboratorsConnection: { edges: [], totalCount: 0 },
      },
      isShared: true,
      collaborators: [],
    }));

    render(<ListSettings route={editRoute} />);
    expect(screen.getByText(/This list is linked to the home/)).toBeTruthy();
  });

  it('navigates to the linked home when a non-owner taps Manage Home', () => {
    const ownerHelpers = require('#utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(false);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: true,
        homeId: 'h1',
        home: {
          name: 'Family Home',
          myMembership: { id: 'm1', role: 'MEMBER' },
        },
        createdBy: { id: 'u2' },
        collaboratorsConnection: { edges: [], totalCount: 0 },
      },
      isShared: true,
      collaborators: [],
    }));

    const { useAppNavigation } = require('#hooks/navigation/useAppNavigation');
    const { toHomeDetail } = useAppNavigation();

    render(<ListSettings route={editRoute} />);
    fireEvent.press(screen.getByText('Manage Home'));
    expect(toHomeDetail).toHaveBeenCalledWith({ homeId: 'h1' });
  });

  it('pops back when a non-owner has lost access to the list', () => {
    // No ownership, no collaborator row, and no home membership — the only way
    // this state arises is the user having just left the linked home, so the
    // screen should self-unwind instead of stranding them on a ghost list.
    const ownerHelpers = require('#utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(false);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: true,
        homeId: 'h1',
        home: null,
        createdBy: { id: 'u2' },
        collaboratorsConnection: { edges: [], totalCount: 0 },
      },
      isShared: false,
      collaborators: [],
    }));

    const { useAppNavigation } = require('#hooks/navigation/useAppNavigation');
    const { goBack } = useAppNavigation();

    render(<ListSettings route={editRoute} />);
    expect(goBack).toHaveBeenCalled();
  });

  it('shows shared info when list is shared and user is owner', () => {
    const ownerHelpers = require('#utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(true);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: true,
        homeId: null,
        home: null,
        createdBy: { id: 'u1' },
        collaboratorsConnection: { edges: [], totalCount: 2 },
      },
      isShared: true,
      collaborators: [
        { id: 'c1', email: 'a@test.com' },
        { id: 'c2', email: 'b@test.com' },
      ],
    }));

    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('This list is shared with 2 members')).toBeTruthy();
  });

  it('shows "Personal (No Home)" as default home picker text', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.getByText('Personal (No Home)')).toBeTruthy();
  });
});
