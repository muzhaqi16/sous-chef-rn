'use no memo';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AddEditItem } from '../AddEditItem';

jest.mock('#/apollo/links/tokenScheduler', () => ({ tokenScheduler: { schedule: jest.fn(), cancel: jest.fn() } }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));

const mockGoBack = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn(), navigateTo: {} }),
}));

const mockUpdateField = jest.fn();
jest.mock('#/hooks/shoppingList/useShoppingListItemForm', () => ({
  useShoppingListItemForm: () => ({
    formState: {
      itemName: '',
      quantityInput: '1',
      unit: '',
      notes: '',
      category: '',
      estimatedPrice: '',
    },
    updateField: mockUpdateField,
    setFromItem: jest.fn(),
    buildUnitInput: jest.fn(() => ({})),
    buildDirtyInput: jest.fn(() => ({})),
    hasDirtyFields: false,
  }),
}));

jest.mock('#generated', () => ({
  useAddItemToShoppingListMutation: jest.fn(() => [jest.fn(() => Promise.resolve({ data: null })), { loading: false }]),
  useUpdateShoppingListItemMutation: jest.fn(() => [jest.fn(() => Promise.resolve({ data: null })), { loading: false }]),
  useGetShoppingListItemQuery: jest.fn(() => ({ data: null, loading: false })),
  ShoppingListItemDisplayFragmentDoc: {},
  CategoryType: { General: 'GENERAL' },
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => ''),
}));
jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any, onError?: any) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      if (onError) onError(e);
    } finally {
      setLoading(false);
    }
  }),
}));

jest.mock('#components/organisms/FormModal', () => ({
  FormModal: ({ title, children, onClose, onSave, testID, submitButtonTestID }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
        <Pressable testID={submitButtonTestID} onPress={onSave}><Text>Submit</Text></Pressable>
        <Pressable testID="close-button" onPress={onClose}><Text>Close</Text></Pressable>
      </View>
    );
  },
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: ({ label, testID, ...props }: any) => {
    const { View, Text, TextInput } = require('react-native');
    return <View><Text>{label}</Text><TextInput testID={testID} {...props} /></View>;
  },
}));
jest.mock('#components/molecules/AutocompleteField/ItemAutocompleteField', () => ({
  ItemAutocompleteField: ({ label, testID }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={testID}><Text>{label}</Text></View>;
  },
}));
jest.mock('#components/molecules/AutocompleteField/UnitAutocompleteField', () => ({
  UnitAutocompleteField: ({ label, testID }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={testID}><Text>{label}</Text></View>;
  },
}));
jest.mock('#components/molecules/AutocompleteField/CategoryAutocompleteField', () => ({
  CategoryAutocompleteField: ({ label }: any) => {
    const { View, Text } = require('react-native');
    return <View><Text>{label}</Text></View>;
  },
}));
jest.mock('#components/molecules/EditableCounter', () => ({
  EditableCounter: ({ label, testID }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={testID}><Text>{label}</Text></View>;
  },
}));
jest.mock('#components/molecules/FieldRow', () => ({
  FieldRow: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

describe('AddEditItem', () => {
  const addRoute = { params: { listId: 'sl1' } };
  const editRoute = { params: { listId: 'sl1', itemId: 'item1' } };

  beforeEach(() => jest.clearAllMocks());

  it('renders add item title', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('renders edit item title', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByText('Edit Item')).toBeTruthy();
  });

  it('shows the add-item modal testID when adding', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-modal')).toBeTruthy();
  });

  it('shows the edit-item modal testID when editing', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByTestId('edit-item-modal')).toBeTruthy();
  });

  it('shows item name autocomplete field when adding', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-name-input')).toBeTruthy();
  });

  it('shows base input for item name when editing', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByTestId('edit-item-name-input')).toBeTruthy();
  });

  it('shows quantity field', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('shows notes field', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('shows estimated price field', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Estimated Price')).toBeTruthy();
  });

  it('shows category field', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('shows unit field', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('shows correct submit button testID for adding', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-submit-button')).toBeTruthy();
  });

  it('shows correct submit button testID for editing', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByTestId('edit-item-submit-button')).toBeTruthy();
  });

  it('navigates back when close button pressed', () => {
    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('close-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows add-item-quantity-input testID for adding', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-quantity-input')).toBeTruthy();
  });

  it('shows edit-item-quantity-input testID for editing', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByTestId('edit-item-quantity-input')).toBeTruthy();
  });

  it('shows add-item-unit-picker testID for adding', () => {
    render(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-unit-picker')).toBeTruthy();
  });

  it('shows edit-item-unit-picker testID for editing', () => {
    render(<AddEditItem route={editRoute} />);
    expect(screen.getByTestId('edit-item-unit-picker')).toBeTruthy();
  });

  it('renders with initialItemName route param', () => {
    const routeWithInitial = { params: { listId: 'sl1', initialItemName: 'Bread' } };
    render(<AddEditItem route={routeWithInitial} />);
    // updateField should be called with the initial item name
    expect(mockUpdateField).toHaveBeenCalledWith('itemName', 'Bread');
  });

  it('handles save validation for empty item name', () => {
    // Default formState has itemName: '' so save should show alert
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));
    // Should show error for empty item name
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Error', 'Please enter an item name');
  });

  it('handles save validation for empty quantity', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a quantity');
  });

  it('navigates back when edit mode and no dirty fields', () => {
    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: 'pcs',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={editRoute} />);
    fireEvent.press(screen.getByTestId('edit-item-submit-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('calls addItem mutation for new item', async () => {
    const mockAddItem = jest.fn().mockResolvedValue({
      data: {
        addItemToShoppingList: {
          shoppingListItem: { id: 'new-item', name: 'Milk' },
        },
      },
    });

    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '2',
        unit: 'pcs',
        notes: 'whole milk',
        category: 'Dairy',
        estimatedPrice: '4.99',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({ unitId: 'unit-1' })),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    await fireEvent.press(screen.getByTestId('add-item-submit-button'));

    expect(mockAddItem).toHaveBeenCalled();
  });

  it('calls updateItem mutation for edit mode with dirty fields', async () => {
    const mockUpdateItem = jest.fn().mockResolvedValue({
      data: {
        updateShoppingListItem: {
          shoppingListItem: { id: 'item1', name: 'Updated Milk' },
        },
      },
    });

    const { useUpdateShoppingListItemMutation, useGetShoppingListItemQuery } = require('#generated');
    useUpdateShoppingListItemMutation.mockReturnValue([mockUpdateItem, { loading: false }]);
    useGetShoppingListItemQuery.mockReturnValue({
      data: {
        shoppingListItem: { id: 'item1', name: 'Milk', version: 1 },
      },
      loading: false,
    });

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Updated Milk',
        quantityInput: '3',
        unit: 'pcs',
        notes: '',
        category: 'Dairy',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({ itemName: 'Updated Milk', quantity: '3' })),
      hasDirtyFields: true,
    });

    render(<AddEditItem route={editRoute} />);
    await fireEvent.press(screen.getByTestId('edit-item-submit-button'));

    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          id: 'item1',
        }),
      }),
    );
  });

  it('shows error alert when addItem returns no data', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());

    const mockAddItem = jest.fn().mockResolvedValue({ data: null });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    await fireEvent.press(screen.getByTestId('add-item-submit-button'));

    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Failed to add item'),
    );
  });

  it('shows error alert when mutation returns data but no item', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());

    const mockAddItem = jest.fn().mockResolvedValue({
      data: { addItemToShoppingList: { shoppingListItem: null } },
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    await fireEvent.press(screen.getByTestId('add-item-submit-button'));

    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Server error'),
    );
  });

  it('handles version conflict error in edit mode', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict, getVersionConflictMessage } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(true);
    getVersionConflictMessage.mockReturnValue('Item was updated by someone else');

    const mockUpdateItem = jest.fn().mockRejectedValue(new Error('VERSION_CONFLICT'));
    const { useUpdateShoppingListItemMutation } = require('#generated');
    useUpdateShoppingListItemMutation.mockReturnValue([mockUpdateItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({ itemName: 'Milk' })),
      hasDirtyFields: true,
    });

    render(<AddEditItem route={editRoute} />);
    fireEvent.press(screen.getByTestId('edit-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Item Updated',
        'Item was updated by someone else',
        expect.any(Array),
      );
    });
  });

  it('handles network error in error handler', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(false);

    const mockAddItem = jest.fn().mockRejectedValue({ networkError: new Error('timeout'), message: 'Network error' });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Network error'),
      );
    });
  });

  it('handles VALIDATION_ERROR graphQL error', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(false);

    const mockAddItem = jest.fn().mockRejectedValue({
      graphQLErrors: [{ extensions: { code: 'VALIDATION_ERROR' }, message: 'Invalid' }],
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Invalid input'),
      );
    });
  });

  it('handles UNAUTHENTICATED graphQL error', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(false);

    const mockAddItem = jest.fn().mockRejectedValue({
      graphQLErrors: [{ extensions: { code: 'UNAUTHENTICATED' }, message: 'Unauthorized' }],
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Session expired'),
      );
    });
  });

  it('handles generic graphQL error with message', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(false);

    const mockAddItem = jest.fn().mockRejectedValue({
      graphQLErrors: [{ extensions: { code: 'INTERNAL_ERROR' }, message: 'Something broke' }],
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Something broke'),
      );
    });
  });

  it('handles generic error without graphQLErrors or networkError', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());
    const { handleVersionConflict } = require('#/utils/errors/versionConflict');
    handleVersionConflict.mockReturnValue(false);

    const mockAddItem = jest.fn().mockRejectedValue(new Error('Unknown'));
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    fireEvent.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Please try again'),
      );
    });
  });

  it('includes estimatedPrice in add mutation when provided', async () => {
    const mockAddItem = jest.fn().mockResolvedValue({
      data: {
        addItemToShoppingList: { shoppingListItem: { id: 'new-item', name: 'Steak' } },
      },
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Steak',
        quantityInput: '1',
        unit: 'lb',
        notes: '',
        category: 'Meat',
        estimatedPrice: '12.99',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    await fireEvent.press(screen.getByTestId('add-item-submit-button'));

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            estimatedPrice: 12.99,
          }),
        }),
      }),
    );
  });

  it('populates form from existing item data in edit mode', () => {
    const mockSetFromItem = jest.fn();
    const { useGetShoppingListItemQuery } = require('#generated');
    useGetShoppingListItemQuery.mockReturnValue({
      data: {
        shoppingListItem: { id: 'item1', name: 'Bread', version: 2, quantity: '1' },
      },
      loading: false,
    });

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Bread',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: mockSetFromItem,
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={editRoute} />);
    expect(mockSetFromItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item1', name: 'Bread', version: 2 }),
    );
  });

  it('shows server error alert when update returns no item data', async () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());

    const mockUpdateItem = jest.fn().mockResolvedValue({
      data: { updateShoppingListItem: { shoppingListItem: null } },
    });
    const { useUpdateShoppingListItemMutation } = require('#generated');
    useUpdateShoppingListItemMutation.mockReturnValue([mockUpdateItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({ itemName: 'Milk' })),
      hasDirtyFields: true,
    });

    render(<AddEditItem route={editRoute} />);
    await fireEvent.press(screen.getByTestId('edit-item-submit-button'));

    expect(require('react-native').Alert.alert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Server error'),
    );
  });

  it('navigates back on successful add', async () => {
    const mockAddItem = jest.fn().mockResolvedValue({
      data: {
        addItemToShoppingList: {
          shoppingListItem: { id: 'new-item', name: 'Milk' },
        },
      },
    });
    const { useAddItemToShoppingListMutation } = require('#generated');
    useAddItemToShoppingListMutation.mockReturnValue([mockAddItem, { loading: false }]);

    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: 'Milk',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    render(<AddEditItem route={addRoute} />);
    await fireEvent.press(screen.getByTestId('add-item-submit-button'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not prepopulate item name when in edit mode even with initialItemName', () => {
    jest.spyOn(require('#/hooks/shoppingList/useShoppingListItemForm'), 'useShoppingListItemForm').mockReturnValue({
      formState: {
        itemName: '',
        quantityInput: '1',
        unit: '',
        notes: '',
        category: '',
        estimatedPrice: '',
      },
      updateField: mockUpdateField,
      setFromItem: jest.fn(),
      buildUnitInput: jest.fn(() => ({})),
      buildDirtyInput: jest.fn(() => ({})),
      hasDirtyFields: false,
    });

    const routeWithBoth = { params: { listId: 'sl1', itemId: 'item1', initialItemName: 'Bread' } };
    render(<AddEditItem route={routeWithBoth} />);
    // In edit mode, initialItemName should not trigger updateField
    expect(mockUpdateField).not.toHaveBeenCalledWith('itemName', 'Bread');
  });
});
