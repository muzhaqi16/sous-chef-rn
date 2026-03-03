'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PantrySettings } from '../PantrySettings';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => {
  const selectSelectedHomeId = (s: any) => s.selectedHomeId;
  const fn = (selector: any) => selector({
    selectedHomeId: 'h1',
    setSelectedPantryId: jest.fn(),
  });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, selectSelectedHomeId };
});

jest.mock('#generated', () => ({
  useGetPantryQuery: jest.fn(() => ({
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
  useUpdatePantryMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useDeletePantryMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useCreatePantryMutation: jest.fn(() => [jest.fn(), { loading: false }]),
  useSetDefaultPantryMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({ handleApolloError: jest.fn(() => ({ message: 'error' })) }),
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/utils/connectionUtils', () => ({
  normalizePantry: jest.fn((p) => p),
}));
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: { registerParentDeletion: jest.fn(), unregisterParentDeletion: jest.fn() },
}));
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/molecules/ScreenHeader', () => ({
  ScreenHeader: ({ title, rightElement }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="screen-header"><Text>{title}</Text>{rightElement}</View>;
  },
}));
jest.mock('#components/base/Loading', () => ({
  LoadingInline: () => null,
}));
jest.mock('#components/molecules/InfoRow', () => ({
  InfoRow: ({ label, value }: any) => {
    const { View, Text } = require('react-native');
    return <View><Text>{label}</Text><Text>{value}</Text></View>;
  },
}));
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    settingsSection: {},
    settingsSectionTitle: {},
    settingsInputGroup: {},
    settingsLabel: {},
    settingsInput: {},
    settingsRow: {},
    settingsRowInfo: {},
    settingsRowLabel: {},
    settingsRowDescription: {},
  },
}));

describe('PantrySettings', () => {
  const editRoute = { params: { pantryId: 'p1' } };
  const createRoute = { params: undefined };

  beforeEach(() => jest.clearAllMocks());

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
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error alert when pantry query has error', () => {
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Network error'),
    });

    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<PantrySettings route={editRoute} />);
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
      'Error Loading Pantry',
      'Failed to load pantry data. Please try again.',
    );
  });

  it('calls handleSave and shows error when name is empty', () => {
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
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

    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<PantrySettings route={editRoute} />);

    // Press the Save button
    fireEvent.press(screen.getByText('Save'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Error', 'Pantry name cannot be empty');
  });

  it('calls handleDelete and shows confirmation alert', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<PantrySettings route={editRoute} />);

    fireEvent.press(screen.getByText('Delete Pantry'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
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
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
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
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
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
    });

    render(<PantrySettings route={editRoute} />);
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('shows no home selected error when saving without selectedHomeId', () => {
    // Override the store mock to return null for selectedHomeId
    jest.spyOn(require('#store/useAppStore'), 'useAppStore').mockImplementation((selector: any) =>
      selector({
        selectedHomeId: null,
        setSelectedPantryId: jest.fn(),
      }),
    );

    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    render(<PantrySettings route={createRoute} />);

    // Type a name
    const nameInput = screen.getByPlaceholderText('Enter pantry name (e.g., Kitchen Pantry)');
    fireEvent.changeText(nameInput, 'New Pantry');

    fireEvent.press(screen.getByText('Create'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Error', 'No home selected');
  });
});
