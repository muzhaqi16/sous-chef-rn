'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { StorageLocationsScreen } from '../StorageLocationsScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/performance/useScreenTransition');

const mockCreateLocation = jest.fn().mockResolvedValue({ id: 'loc-new' });
const mockUpdateLocation = jest.fn().mockResolvedValue({ id: 'loc-1' });
const mockDeleteLocation = jest.fn().mockResolvedValue(true);
const mockSetDefaultLocation = jest.fn().mockResolvedValue(true);
const mockRefetch = jest.fn().mockResolvedValue({});

jest.mock('#hooks/storageLocation/useStorageLocationManagement', () => ({
  useStorageLocationManagement: jest.fn(() => ({
    locations: [],
    tree: [],
    initialLoading: false,
    creating: false,
    updateLocation: mockUpdateLocation,
    deleteLocation: mockDeleteLocation,
    setDefaultLocation: mockSetDefaultLocation,
    createLocation: mockCreateLocation,
    error: null,
    refetch: mockRefetch,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/templates/DetailTemplate', () => ({
  DetailTemplate: ({ title, sections }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="detail-template">
        <Text>{title}</Text>
        {sections?.map((s: any, i: number) => (
          <View key={i}>{s.content}</View>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/organisms/storageLocation/StorageLocationCard', () => ({
  StorageLocationCard: ({ location, onDelete }: any) => {
    const { Text, Pressable } = require('react-native');
    return (
      <>
        <Text testID={`location-${location.id}`}>{location.name}</Text>
        <Pressable testID={`delete-${location.id}`} onPress={onDelete}>
          <Text>Delete</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('#components/modals/StorageLocationSheet/StorageLocationSheet', () => ({
  StorageLocationSheet: () => null,
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    loadingContainer: {},
    emptyState: {},
    emptyStateTitle: {},
    emptyStateText: {},
  },
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

const defaultRoute = { params: { homeId: 'home-1' } };

describe('StorageLocationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the storage locations screen', () => {
    const { getByTestId } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByTestId('detail-template')).toBeTruthy();
  });

  it('shows loading state when initial loading', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [],
      tree: [],
      initialLoading: true,
      creating: false,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      setDefaultLocation: jest.fn(),
      createLocation: jest.fn(),
      error: null,
      refetch: jest.fn(),
    });

    const tree = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows empty state when no locations exist', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      setDefaultLocation: jest.fn(),
      createLocation: jest.fn(),
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('No Storage Locations')).toBeTruthy();
  });

  it('renders locations in flat view', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Fridge', isDefault: true },
        { id: 'loc-2', name: 'Pantry', isDefault: false },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      setDefaultLocation: jest.fn(),
      createLocation: jest.fn(),
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('Fridge')).toBeTruthy();
    expect(getByText('Pantry')).toBeTruthy();
  });

  it('shows error message when error exists', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      setDefaultLocation: jest.fn(),
      createLocation: jest.fn(),
      error: { message: 'Network error' },
      refetch: jest.fn(),
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });

  it('renders view mode toggles when locations exist', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [{ id: 'loc-1', name: 'Fridge', isDefault: false }],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      setDefaultLocation: jest.fn(),
      createLocation: jest.fn(),
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('List View')).toBeTruthy();
    expect(getByText('Tree View')).toBeTruthy();
  });

  it('renders with creating state', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [{ id: 'loc-1', name: 'Fridge', isDefault: true }],
      tree: [],
      initialLoading: false,
      creating: true,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const tree = render(<StorageLocationsScreen route={defaultRoute} />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with tree data for tree view', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Kitchen', isDefault: true, parentId: null },
        { id: 'loc-2', name: 'Fridge', isDefault: false, parentId: 'loc-1' },
      ],
      tree: [
        {
          id: 'loc-1',
          name: 'Kitchen',
          isDefault: true,
          children: [{ id: 'loc-2', name: 'Fridge', isDefault: false, children: [] }],
        },
      ],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('Kitchen')).toBeTruthy();
    expect(getByText('Fridge')).toBeTruthy();
  });

  it('renders with default location marked', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Fridge', isDefault: true },
        { id: 'loc-2', name: 'Pantry', isDefault: false },
        { id: 'loc-3', name: 'Freezer', isDefault: false },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('Fridge')).toBeTruthy();
    expect(getByText('Pantry')).toBeTruthy();
    expect(getByText('Freezer')).toBeTruthy();
  });

  it('renders without homeId in route params', () => {
    const noParamsRoute = { params: {} } as any;
    const tree = render(<StorageLocationsScreen route={noParamsRoute} />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with a single location', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [{ id: 'loc-1', name: 'Main Storage', isDefault: true }],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    expect(getByText('Main Storage')).toBeTruthy();
  });

  it('shows blocking dialog when deleting default location', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Fridge', isDefault: true, currentItemCount: 0 },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    fireEvent.press(getByTestId('delete-loc-1'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Delete Default Location',
      'Set another location as default first.',
      [{ text: 'OK' }],
    );
    expect(mockDeleteLocation).not.toHaveBeenCalled();
  });

  it('shows informational dialog when deleting location with items', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Fridge', isDefault: false, currentItemCount: 5 },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    fireEvent.press(getByTestId('delete-loc-1'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Delete Location',
      '"Fridge" has 5 items. Move or remove them first.',
      [{ text: 'Got It' }],
    );
    expect(mockDeleteLocation).not.toHaveBeenCalled();
  });

  it('shows informational dialog when deleting location with children', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Kitchen', isDefault: false, currentItemCount: 0 },
        { id: 'loc-2', name: 'Fridge', isDefault: false, currentItemCount: 0, parentLocation: { id: 'loc-1' } },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    fireEvent.press(getByTestId('delete-loc-1'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Delete Location',
      '"Kitchen" has 1 sub-location. Move or remove them first.',
      [{ text: 'Got It' }],
    );
    expect(mockDeleteLocation).not.toHaveBeenCalled();
  });

  it('shows normal confirmation when deleting empty non-default location', () => {
    const { useStorageLocationManagement } = jest.requireMock(
      '#hooks/storageLocation/useStorageLocationManagement',
    );
    useStorageLocationManagement.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Empty Shelf', isDefault: false, currentItemCount: 0 },
      ],
      tree: [],
      initialLoading: false,
      creating: false,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      setDefaultLocation: mockSetDefaultLocation,
      createLocation: mockCreateLocation,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <StorageLocationsScreen route={defaultRoute} />,
    );
    fireEvent.press(getByTestId('delete-loc-1'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Storage Location',
      'Are you sure you want to delete "Empty Shelf"? This cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ]),
    );
  });
});
