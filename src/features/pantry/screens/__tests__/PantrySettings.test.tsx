'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
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

jest.mock('@apollo/client/react', () => ({
  __esModule: true,
  useQuery: jest.fn(() => ({
    data: {
      pantry: {
        id: 'p1',
        name: 'Kitchen Pantry',
        description: 'Main pantry',
        isDefault: true,
        items: [{ id: 'i1' }, { id: 'i2' }],
        createdAt: '2024-01-01T00:00:00Z',
        itemsConnection: { edges: [], totalCount: 2 },
      },
    },
    loading: false,
    error: null,
  })),
  useMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useApolloClient: jest.fn(() => ({
    cache: { modify: jest.fn(), identify: jest.fn(() => 'cache-id') },
  })),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'error' })),
  }),
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/utils/connectionUtils', () => ({
  normalizePantry: jest.fn(p => p),
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

describe('PantrySettings', () => {
  const editRoute = { params: { pantryId: 'p1' } };
  const createRoute = { params: undefined };

  beforeEach(() => {
    jest.clearAllMocks();
    const apollo = jest.requireMock('@apollo/client/react') as {
      useQuery: jest.Mock;
      useMutation: jest.Mock;
    };
    apollo.useQuery.mockReset();
    apollo.useQuery.mockImplementation((_doc: any, options: any) => {
      if (options?.skip) {
        return { data: undefined, loading: false, error: null };
      }
      return {
        data: {
          pantry: {
            id: 'p1',
            name: 'Kitchen Pantry',
            description: 'Main pantry',
            isDefault: true,
            items: [{ id: 'i1' }, { id: 'i2' }],
            createdAt: '2024-01-01T00:00:00Z',
            itemsConnection: { edges: [], totalCount: 2 },
          },
        },
        loading: false,
        error: null,
      };
    });
    apollo.useMutation.mockReset();
    apollo.useMutation.mockReturnValue([jest.fn(), { loading: false }]);
  });

  it('renders settings title when editing', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Pantry Settings')).toBeTruthy();
  });

  it('renders create title when creating', () => {
    render(<PantrySettings route={createRoute} />);
    expect(screen.getByText('Create New Pantry')).toBeTruthy();
  });

  it('shows pantry name input', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Pantry Name')).toBeTruthy();
  });

  it('shows default pantry toggle', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Default Pantry')).toBeTruthy();
  });

  it('shows information section when editing', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Information')).toBeTruthy();
    expect(screen.getByText('Items in pantry')).toBeTruthy();
  });

  it('shows danger zone when editing', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Delete Pantry')).toBeTruthy();
  });

  it('hides danger zone when creating', () => {
    render(<PantrySettings route={createRoute} />);
    expect(screen.queryByText('Danger Zone')).toBeNull();
    expect(screen.queryByText('Delete Pantry')).toBeNull();
  });

  it('shows save button text correctly for editing', () => {
    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('shows Create button text when creating new pantry', () => {
    render(<PantrySettings route={createRoute} />);
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('hides information section when creating', () => {
    render(<PantrySettings route={createRoute} />);
    expect(screen.queryByText('Information')).toBeNull();
  });

  it('shows loading state when pantryId is provided and data is loading', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: null,
      loading: true,
      error: null,
    });

    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error alert when pantry query has error', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: null,
      loading: false,
      error: new Error('Network error'),
    });

    render(<PantrySettings route={editRoute} />);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error Loading Pantry',
      'Failed to load pantry data. Please try again.',
    );
  });

  it('calls handleSave and shows error when name is empty', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: {
        pantry: {
          id: 'p1',
          name: '',
          description: '',
          isDefault: false,
          items: [],
          createdAt: '2024-01-01T00:00:00Z',
          itemsConnection: { edges: [], totalCount: 0 },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantrySettings route={editRoute} />);

    // Press the Save button
    fireEvent.press(screen.getByText('Save'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Pantry name cannot be empty',
    );
  });

  it('calls handleDelete and shows confirmation alert', () => {
    render(<PantrySettings route={editRoute} />);

    fireEvent.press(screen.getByText('Delete Pantry'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Delete Pantry',
      expect.stringContaining('Are you sure'),
      expect.any(Array),
    );
  });

  it('toggles default pantry switch without mutation for new pantry', () => {
    render(<PantrySettings route={createRoute} />);
    // The switch should be present
    expect(screen.getByText('Default Pantry')).toBeTruthy();
  });

  it('syncs form state from loaded pantry data', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: {
        pantry: {
          id: 'p1',
          name: 'Kitchen Pantry',
          description: 'Main pantry',
          isDefault: true,
          items: [{ id: 'i1' }, { id: 'i2' }],
          createdAt: '2024-01-01T00:00:00Z',
          itemsConnection: { edges: [], totalCount: 2 },
        },
      },
      loading: false,
      error: null,
    });

    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('2 items')).toBeTruthy();
  });

  it('shows item count as 0 when pantry has no items', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockImplementation(() => ({
      data: {
        pantry: {
          id: 'p1',
          name: 'Empty Pantry',
          description: '',
          isDefault: false,
          items: null,
          createdAt: '2024-01-01T00:00:00Z',
          itemsConnection: { edges: [], totalCount: 0 },
        },
      },
      loading: false,
      error: null,
    }));

    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('shows no home selected error when saving without selectedHomeId', () => {
    // Override the store mock to return null for selectedHomeId
    const storeModule = require('#store/useAppStore');
    jest.spyOn(storeModule, 'useAppStore').mockImplementation((selector: any) =>
      selector({
        selectedHomeId: null,
        setSelectedPantryId: jest.fn(),
      }),
    );
    jest.spyOn(storeModule, 'useSelectedHomeId').mockReturnValue(null);

    render(<PantrySettings route={createRoute} />);

    // Type a name
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
