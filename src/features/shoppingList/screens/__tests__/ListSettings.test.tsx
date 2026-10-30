'use no memo';

import { memoryIntents } from '#/test-utils/memoryPlatform';
import React from 'react';
import type { BarAction } from '#components/molecules/BarActions';
import type { TextInputProps } from 'react-native';
import { screen, fireEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import type { InfoRowProps } from '#components/atoms/InfoRow';
import { ListSettings } from '../ListSettings';
import { t } from '#/i18n';
import { Text as AppText } from '#components/atoms/Text';

const render = (ui: React.ReactElement) => renderWithApollo(ui);

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const fn = <T,>(
    selector: (state: {
      setSelectedShoppingListId: () => void;
      cachedStores: never[];
    }) => T,
  ): T =>
    selector({
      setSelectedShoppingListId: jest.fn(),
      cachedStores: [],
    });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useUser: jest.fn(() => ({ id: 'u1', email: 'test@test.com' })),
    useIsOnline: jest.fn(() => true),
  };
});

// One object, as a cached list is: the screen re-seeds its form when it changes.
const mockListDetails = {
  shoppingList: {
    id: 'sl1',
    name: 'Weekly Groceries',
    isDefault: true,
    homeId: null,
    home: null,
    createdBy: { id: 'u1' },
    collaboratorsConnection: { edges: [], totalCount: 0 },
    targetStore: null,
  },
  isShared: false,
  collaborators: [],
};
jest.mock('#features/shoppingList/hooks/useShoppingListDetails', () => ({
  useShoppingListDetails: () => mockListDetails,
}));

jest.mock('#features/home/hooks/useLazyHomeData', () => ({
  useLazyHomeData: () => ({
    homes: [],
    fetchHomeData: jest.fn(),
    isLoaded: false,
  }),
}));

jest.mock('#features/shoppingList/hooks/useShoppingListsQuery', () => ({
  useShoppingListsQuery: () => ({ lists: [] }),
}));

jest.mock('#features/shoppingList/hooks/useShoppingListTemplates', () => ({
  useShoppingListTemplates: jest.fn(() => ({
    templates: [],
    loading: false,
  })),
}));

const mockCreateFromTemplate = jest.fn(async () => 'sl-new');
jest.mock(
  '#features/shoppingList/hooks/mutations/useShoppingListTemplate',
  () => ({
    useShoppingListTemplate: () => ({
      markAsTemplate: jest.fn(),
      createFromTemplate: mockCreateFromTemplate,
      marking: false,
      creating: false,
    }),
  }),
);

const mockUpdateShoppingList = jest.fn(async () => null);
jest.mock(
  '#features/shoppingList/hooks/mutations/useUpdateShoppingList',
  () => ({
    useUpdateShoppingList: () => ({
      updateShoppingList: mockUpdateShoppingList,
    }),
  }),
);

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/services/errorService');
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));
jest.mock('#features/shoppingList/utils/ownershipHelpers', () => {
  const isShoppingListOwner = jest.fn(() => true);
  return {
    isShoppingListOwner,
    // The real answer over the mocked owner check, which the tests switch.
    listOwnershipOf: (listId: string | undefined, list: unknown) =>
      !listId
        ? 'owner'
        : !list
        ? 'unknown'
        : isShoppingListOwner()
        ? 'owner'
        : 'other',
    getShoppingListRole: jest.fn(() => 'OWNER'),
    formatRoleDisplay: jest.fn(() => 'Owner'),
    getShoppingListOwnerInfo: jest.fn(() => null),
  };
});

jest.mock('#components/templates/Screen', () => ({
  Screen: ({
    header,
    children,
  }: {
    header?: { title?: string; actions?: BarAction[] };
    children: React.ReactNode;
  }) => {
    const { View, Text } = require('react-native');
    const { BarActions } = require('#components/molecules/BarActions');
    return (
      <View>
        <View testID="screen-header">
          <Text>{header?.title}</Text>
          <BarActions actions={header?.actions} />
        </View>
        {children}
      </View>
    );
  },
}));
jest.mock('#components/atoms/InfoRow', () => ({
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
// Renders its options only while open, so a closed picker's labels can't
// collide with the screen's own text in queries.
jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: ({
    visible,
    options,
    onSelect,
  }: {
    visible: boolean;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) => {
    if (!visible) return null;
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        {options.map(opt => (
          <Pressable key={opt.value} onPress={() => onSelect(opt.value)}>
            <Text>{`option:${opt.label}`}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/BaseInput/BaseInput', () => ({
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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

  it('caps the name at the length the server accepts', () => {
    render(<ListSettings route={createRoute} />);
    expect(screen.getByPlaceholderText('Enter list name').props.maxLength).toBe(
      100,
    );
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

  // Its money has a screen of its own, reached from the list's header.
  it('holds no store, comparison or budget settings', () => {
    render(<ListSettings route={editRoute} />);

    expect(screen.queryByText('Shopping at')).toBeNull();
    expect(screen.queryByText("Where it's cheapest")).toBeNull();
    expect(screen.queryByText('Budget Limit')).toBeNull();
    expect(screen.queryByText('Price Tracking')).toBeNull();
  });

  // The accent says there is something to save; with nothing, Save still saves.
  it('reads Save in plain text until something changes', () => {
    render(<ListSettings route={editRoute} />);
    const saveTone = () =>
      screen
        .UNSAFE_getAllByType(AppText)
        .find(node => node.props.children === 'Save')?.props.tone;

    expect(saveTone()).toBe('primary');

    fireEvent.changeText(
      screen.getByDisplayValue('Weekly Groceries'),
      'Weekly Shop',
    );

    expect(saveTone()).toBe('accent');

    // Edited back to what it was, there is nothing to save again.
    fireEvent.changeText(
      screen.getByDisplayValue('Weekly Shop'),
      'Weekly Groceries',
    );

    expect(saveTone()).toBe('primary');
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
    const {
      isShoppingListOwner,
    } = require('#features/shoppingList/utils/ownershipHelpers');
    isShoppingListOwner.mockReturnValue(false);

    const {
      getShoppingListRole,
    } = require('#features/shoppingList/utils/ownershipHelpers');
    getShoppingListRole.mockReturnValue('EDITOR');

    const {
      formatRoleDisplay,
    } = require('#features/shoppingList/utils/ownershipHelpers');
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
    } = require('#features/shoppingList/utils/ownershipHelpers');
    isShoppingListOwner.mockReturnValue(false);
    getShoppingListRole.mockReturnValue('EDITOR');
    formatRoleDisplay.mockReturnValue('Editor');

    render(<ListSettings route={editRoute} />);
    expect(screen.getByText('Your Role')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('shows Leave List section for non-owner collaborator', () => {
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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

  // The API's EDIT reaches a home MEMBER: the settings are theirs to change,
  // but the default is the owner's mark and sharing the owner's roster.
  it("lets a home MEMBER who doesn't own the list edit it, not its default", () => {
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
    ownerHelpers.isShoppingListOwner.mockReturnValue(false);

    const useShoppingListDetailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
    useShoppingListDetailsModule.useShoppingListDetails = jest.fn(() => ({
      shoppingList: {
        id: 'sl1',
        name: 'Weekly Groceries',
        isDefault: false,
        homeId: 'h1',
        home: {
          name: 'Family Home',
          myMembership: { id: 'm1', role: 'MEMBER' },
        },
        collaboratorsConnection: { edges: [], totalCount: 0 },
      },
      isShared: true,
      collaborators: [],
    }));

    render(<ListSettings route={editRoute} />);
    expect(
      screen.getByText(t('shoppingListScreens.listSettings')),
    ).toBeTruthy();
    expect(screen.getByText(t('shoppingListScreens.listName'))).toBeTruthy();
    expect(screen.queryByText(t('shoppingListScreens.defaultList'))).toBeNull();
    expect(
      screen.queryByText(t('shoppingListScreens.manageMembers')),
    ).toBeNull();
    expect(screen.getAllByText(t('labels.leaveList')).length).toBeGreaterThan(
      0,
    );
  });

  // The API lets a home's OWNER and ADMINs delete its lists; a MEMBER edits.
  it.each([
    ['ADMIN', true],
    ['MEMBER', false],
  ])(
    'offers Delete List to a home %s who does not own the list: %s',
    (role, offered) => {
      const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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
            myMembership: { id: 'm1', role },
          },
          createdBy: { id: 'u2' },
          collaboratorsConnection: { edges: [], totalCount: 0 },
        },
        isShared: true,
        collaborators: [],
      }));

      render(<ListSettings route={editRoute} />);
      expect(!!screen.queryByText(t('labels.deleteList'))).toBe(offered);
    },
  );

  it('navigates to the linked home when a non-owner taps Manage Home', () => {
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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

    const goBack = jest.spyOn(memoryIntents(), 'goBack');

    render(<ListSettings route={editRoute} />);
    expect(goBack).toHaveBeenCalled();
  });

  it('shows shared info when list is shared and user is owner', () => {
    const ownerHelpers = require('#features/shoppingList/utils/ownershipHelpers');
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

  describe('creating from a saved template', () => {
    const templates = [
      { id: 'tpl1', displayName: 'Weekly Staples', totalItems: 12 },
      { id: 'tpl2', displayName: 'Party Supplies', totalItems: 5 },
    ];

    const setTemplates = (value: typeof templates) => {
      const {
        useShoppingListTemplates,
      } = require('#features/shoppingList/hooks/useShoppingListTemplates');
      useShoppingListTemplates.mockReturnValue({
        templates: value,
        loading: false,
      });
    };

    beforeEach(() => setTemplates(templates));
    afterAll(() => setTemplates([]));

    it('offers the templates picker when creating', () => {
      render(<ListSettings route={createRoute} />);
      expect(screen.getByText('Start From Template')).toBeTruthy();
      expect(screen.getByText('None (Blank List)')).toBeTruthy();
    });

    it('hides the templates picker when editing an existing list', () => {
      render(<ListSettings route={editRoute} />);
      expect(screen.queryByText('Start From Template')).toBeNull();
    });

    it('hides the picker when the user has no saved templates', () => {
      setTemplates([]);
      render(<ListSettings route={createRoute} />);
      expect(screen.queryByText('Start From Template')).toBeNull();
    });

    it('lists every template as an option', () => {
      render(<ListSettings route={createRoute} />);
      fireEvent.press(screen.getByText('None (Blank List)'));
      expect(screen.getByText('option:Weekly Staples')).toBeTruthy();
      expect(screen.getByText('option:Party Supplies')).toBeTruthy();
    });

    it('names the list after the chosen template and keeps home linking open', () => {
      render(<ListSettings route={createRoute} />);
      fireEvent.press(screen.getByText('None (Blank List)'));
      fireEvent.press(screen.getByText('option:Weekly Staples'));

      expect(screen.getByDisplayValue('Weekly Staples')).toBeTruthy();
      // The copy is assembled on the device, so it carries a home like any
      // other create.
      expect(screen.getByText('Personal (No Home)')).toBeTruthy();
    });

    it('creates from the template and opens the new list', async () => {
      const goBack = jest.spyOn(memoryIntents(), 'goBack');

      render(<ListSettings route={createRoute} />);
      fireEvent.press(screen.getByText('None (Blank List)'));
      fireEvent.press(screen.getByText('option:Party Supplies'));
      fireEvent.press(screen.getByText('Create'));

      await drainTimers();
      expect(mockCreateFromTemplate).toHaveBeenCalledWith(
        'tpl2',
        'Party Supplies',
        undefined,
      );
      expect(goBack).toHaveBeenCalled();
    });

    it('leaves the blank-list path alone when no template is chosen', async () => {
      render(<ListSettings route={createRoute} />);
      fireEvent.changeText(screen.getByDisplayValue(''), 'Groceries');
      fireEvent.press(screen.getByText('Create'));

      await drainTimers();
      expect(mockCreateFromTemplate).not.toHaveBeenCalled();
    });

    it('offers the picker while offline — the copy is derived, not requested', () => {
      const { useIsOnline } = require('#store/useAppStore');
      useIsOnline.mockReturnValue(false);

      render(<ListSettings route={createRoute} />);
      expect(screen.getByText('None (Blank List)')).toBeTruthy();

      useIsOnline.mockReturnValue(true);
    });
  });

  describe('while ownership has not resolved', () => {
    // The detail query is `errorPolicy: 'ignore'`, so a failure and a cache
    // that never held the list both arrive as no list at all. Reading that as
    // "not the owner" shows the owner the viewer's screen, with reminder,
    // recurring, template, archive and delete simply absent.
    const withoutDetails = () => {
      const detailsModule = require('#features/shoppingList/hooks/useShoppingListDetails');
      detailsModule.useShoppingListDetails = jest.fn(() => ({
        shoppingList: null,
        isShared: false,
        collaborators: [],
        ownerships: [],
        refetch: jest.fn(),
      }));
    };

    it('waits rather than rendering the viewer screen', () => {
      withoutDetails();

      render(<ListSettings route={editRoute} />);

      expect(screen.queryByText('List Information')).toBeNull();
      expect(screen.queryByText('List Info')).toBeNull();
    });

    it('offers no Save it cannot know the user may use', () => {
      withoutDetails();

      render(<ListSettings route={editRoute} />);

      expect(screen.queryByText('Save')).toBeNull();
    });
  });
});
