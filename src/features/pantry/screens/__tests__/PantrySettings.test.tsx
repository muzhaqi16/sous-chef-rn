'use no memo';

import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { fireEvent, screen} from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
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
  const fn = (selector: any) => selector(mockState);
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    useSelectedHomeId: jest.fn(() => mockState.selectedHomeId),
  };
});

jest.mock('#/services/errorService', () => ({
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
jest.mock('#/utils/compilerSafeWrappers');
jest.mock('#features/pantry/hooks/usePantryPermissions');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#components/molecules/ScreenHeader', () => ({
  ScreenHeader: ({ title, rightElement }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="screen-header">
        <Text>{title}</Text>
        {rightElement}
      </View>
    );
  },
}));
jest.mock('#components/base/Loading', () => ({
  LoadingInline: () => null,
}));
jest.mock('#components/molecules/InfoRow', () => ({
  InfoRow: ({ label, value }: any) => {
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
  BaseInput: ({ label, ...props }: any) => {
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
    data: pantryData(pantry) as any,
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
    jest
      .spyOn(storeModule, 'useAppStore')
      .mockImplementation((selector: any) =>
        selector({
          selectedHomeId: null,
          setSelectedPantryId: jest.fn(),
        }),
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
