'use no memo';

import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  DeletePantryDocument,
  GetPantryDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  removeOptimisticPantry,
  restorePantryToHomeCache,
} from '#features/pantry/utils/optimisticPantry';
import {
  pantryData,
  type PantryFixture,
} from '../../../../../__tests__/helpers/fixtures/pantryFixtures';
import { alertService } from '#/services/alertService';
import { PantrySettings } from '../PantrySettings';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const mockState = {
    selectedHomeId: 'h1',
    setSelectedPantryId: jest.fn(),
  };
  const fn = (selector: (state: typeof mockState) => unknown) =>
    selector(mockState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useSelectedHomeId: jest.fn(() => mockState.selectedHomeId),
    useSetSelectedPantryId: jest.fn(() => mockState.setSelectedPantryId),
  };
});

jest.mock('#/services/errorService', () => ({
  // User-facing copy, resolved from the error's code. Present so a suite
  // reaching the alert path does not fail on a missing export.
  localizedErrorMessage: jest.fn(() => 'Something went wrong.'),
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'error' })),
  }),
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));
jest.mock('#/utils/finallyHelpers');
jest.mock('#features/pantry/hooks/usePantryPermissions');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Spread the real module: the screen imports several of its writers, and a
// trimmed factory fails at import rather than at the assertion.
jest.mock('#features/pantry/utils/optimisticPantry', () => ({
  ...jest.requireActual('#features/pantry/utils/optimisticPantry'),
  removeOptimisticPantry: jest.fn(),
  restorePantryToHomeCache: jest.fn(),
}));

jest.mock('#components/molecules/ScreenHeader', () => ({
  ScreenHeader: ({
    title,
    rightElement,
  }: {
    title?: string;
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
jest.mock('#components/atoms/Loading', () => ({
  LoadingInline: () => null,
}));
jest.mock('#components/molecules/InfoRow', () => ({
  InfoRow: ({ label, value }: { label?: string; value?: string }) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </View>
    );
  },
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: ({
    label,
    ...props
  }: {
    label?: string;
    [key: string]: unknown;
  }) => {
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

function cacheWithPantry(pantry: PantryFixture): InMemoryCache {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: GetPantryDocument,
    variables: { id: pantry.id, itemsFirst: 25, storageLocationsFirst: 15 },
    data: pantryData(pantry),
  });
  return cache;
}

const editRoute = { params: { pantryId: 'p1' } };
const createRoute = { params: undefined };

const defaultPantry: PantryFixture = {
  id: 'p1',
  name: 'Kitchen Pantry',
  description: 'Main pantry',
  isDefault: true,
  items: [{ id: 'i1' }, { id: 'i2' }],
};

describe('PantrySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings title when editing', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Pantry Settings')).toBeTruthy();
  });

  it('renders create title when creating', () => {
    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });
    expect(screen.getByText('Create New Pantry')).toBeTruthy();
  });

  it('shows pantry name input', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Pantry Name')).toBeTruthy();
  });

  it('shows default pantry toggle', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Default Pantry')).toBeTruthy();
  });

  it('shows information section when editing', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Information')).toBeTruthy();
    expect(screen.getByText('Items in pantry')).toBeTruthy();
  });

  it('shows danger zone when editing', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Delete Pantry')).toBeTruthy();
  });

  it('hides danger zone when creating', () => {
    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });
    expect(screen.queryByText('Danger Zone')).toBeNull();
    expect(screen.queryByText('Delete Pantry')).toBeNull();
  });

  it('shows save button text correctly for editing', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('shows Create button text when creating new pantry', () => {
    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('hides information section when creating', () => {
    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });
    expect(screen.queryByText('Information')).toBeNull();
  });

  it('calls handleSave and shows error when name is empty', async () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry({
        id: 'p1',
        name: '',
        description: '',
        isDefault: false,
        items: [],
      }),
    });

    fireEvent.press(screen.getByText('Save'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Pantry name cannot be empty',
    );
  });

  it('calls handleDelete and shows confirmation alert', async () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry(defaultPantry),
    });

    fireEvent.press(screen.getByText('Delete Pantry'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Delete Pantry',
      expect.stringContaining('Are you sure'),
      expect.any(Array),
    );
  });

  describe('deleting is local-first', () => {
    /** Press Delete Pantry, then the destructive button in its confirmation. */
    async function confirmDelete() {
      fireEvent.press(screen.getByText('Delete Pantry'));
      const buttons = (alertService.alert as jest.Mock).mock.calls.at(
        -1,
      )?.[2] as { style?: string; onPress?: () => void }[] | undefined;
      const destructive = buttons?.find(b => b.style === 'destructive');
      await act(async () => {
        destructive?.onPress?.();
      });
    }

    it('removes the pantry from the home before the mutation resolves', async () => {
      // `buildDeletePantryUpdater` runs only for a real DeletePantryPayload,
      // and offline there is none — the queue completes with a null result and
      // the replay carries no `update`. Without a pre-fire write the user was
      // returned to a home still listing the pantry they had just deleted.
      const remove = recordMock(DeletePantryDocument, {
        data: {
          deletePantry: {
            __typename: 'DeletePantryPayload',
            pantry: { __typename: 'Pantry', id: 'p1', name: 'Test Pantry' },
          },
        },
      });

      renderWithApollo(<PantrySettings route={editRoute} />, {
        cache: cacheWithPantry(defaultPantry),
        operationMocks: [remove.mock],
      });

      await confirmDelete();

      expect(removeOptimisticPantry).toHaveBeenCalledWith(
        expect.anything(),
        'h1',
        'p1',
        // Unlinked, not evicted: a refusal has to be able to put it back.
        { evictEntity: false },
      );
    });

    it('puts the pantry back when the delete is refused', async () => {
      // A failing mutation RESOLVES under errorPolicy 'all'; the operation
      // mock carries the error rather than a helper being stubbed to throw.
      const refused = recordMock(DeletePantryDocument, {
        error: new Error('refused'),
      });

      renderWithApollo(<PantrySettings route={editRoute} />, {
        cache: cacheWithPantry(defaultPantry),
        operationMocks: [refused.mock],
      });

      await confirmDelete();

      await waitFor(() =>
        expect(restorePantryToHomeCache).toHaveBeenCalledWith(
          expect.anything(),
          'h1',
          'p1',
        ),
      );
    });
  });

  it('toggles default pantry switch without mutation for new pantry', () => {
    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });
    expect(screen.getByText('Default Pantry')).toBeTruthy();
  });

  it('syncs form state from loaded pantry data', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry({
        id: 'p1',
        name: 'Kitchen Pantry',
        description: 'Main pantry',
        isDefault: true,
        items: [{ id: 'i1' }, { id: 'i2' }],
      }),
    });
    expect(screen.getByText('2 items')).toBeTruthy();
  });

  it('shows item count as 0 when pantry has no items', () => {
    renderWithApollo(<PantrySettings route={editRoute} />, {
      cache: cacheWithPantry({
        id: 'p1',
        name: 'Empty Pantry',
        description: '',
        isDefault: false,
        items: [],
      }),
    });
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('shows no home selected error when saving without selectedHomeId', () => {
    const storeModule = require('#store/useAppStore');
    const noHomeState = {
      selectedHomeId: null,
      setSelectedPantryId: jest.fn(),
    };
    jest
      .spyOn(storeModule, 'useAppStore')
      .mockImplementation((selector: unknown) =>
        typeof selector === 'function' ? selector(noHomeState) : undefined,
      );
    jest.spyOn(storeModule, 'useSelectedHomeId').mockReturnValue(null);

    renderWithApollo(<PantrySettings route={createRoute} />, {
      cache: new InMemoryCache(),
    });

    const nameInput = screen.getByPlaceholderText(
      'Enter pantry name (e.g., Kitchen Pantry)',
    );
    fireEvent.changeText(nameInput, 'New Pantry');

    fireEvent.press(screen.getByText('Create'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'No home selected',
    );
  });
});
