'use no memo';

import React from 'react';
import type { TextInputProps } from 'react-native';
import {
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { handleMutationError } from '#/utils/errorHandlers';
import { AddEditItem } from '../AddEditItem';
import type { ShoppingItemFormData } from '#features/shoppingList/hooks/shoppingItemFormConfig';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
  GetShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

// Delegates to the REAL hook, recording writes on the way through.
//
// Not a hand-rolled stub: the screen renders its fields through
// `Controller control={control}` and react-hook-form's `control` is not
// something a plain object can stand in for. Delegating also means these tests
// exercise the real yup schema, which is what gates Save — a stub would let an
// invalid form submit.
const mockSetFieldValue = jest.fn();
jest.mock('#features/shoppingList/hooks/useShoppingListItemForm', () => ({
  useShoppingListItemForm: (
    ...args: Parameters<
      typeof import('#features/shoppingList/hooks/useShoppingListItemForm').useShoppingListItemForm
    >
  ) => {
    const actual = jest
      .requireActual('#features/shoppingList/hooks/useShoppingListItemForm')
      .useShoppingListItemForm(...args);
    const RN = require('react');
    // Stable identity: AddEditItem lists `setFieldValue` in an effect's deps,
    // and a fresh function each render turns that effect into a render loop.
    const setFieldValue = RN.useCallback((field: string, value: unknown) => {
      mockSetFieldValue(field, value);
      actual.setFieldValue(field, value);
    }, []);
    return { ...actual, setFieldValue };
  },
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => {
  const { classifyCreateResult } = jest.requireActual(
    '#/apollo/utils/classifyCreateResult',
  );
  const revertOptimisticShoppingListItem = jest.fn();
  return {
    addNewItemToShoppingListCache: jest.fn(),
    adoptServerShoppingListItemId: jest.fn(),
    buildAddItemsReconcileUpdate: jest.fn(() => jest.fn()),
    revertOptimisticShoppingListItem,
    addOptimisticShoppingListItem: jest.fn(),
    createOptimisticShoppingListItem: jest.fn((id: string) => ({
      __typename: 'ShoppingListItem',
      id,
    })),
    // Mirror the real reconciler (real classify + mocked revert) so the
    // keep/revert decision under test matches production.
    reconcileShoppingCreate: jest.fn(
      (cache: unknown, listId: string, id: string, result: unknown) => {
        if (classifyCreateResult(result) === 'rejected') {
          revertOptimisticShoppingListItem(cache, listId, id);
          return 'reverted';
        }
        return 'kept';
      },
    ),
  };
});
jest.mock('#/utils/errorHandlers', () => ({
  handleMutationError: jest.fn(),
  versionConflictCheck: jest.fn(() => ({
    detect: jest.fn(),
    handle: jest.fn(),
  })),
}));
jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));
jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#components/organisms/FormModal', () => ({
  FormModal: ({
    title,
    children,
    onClose,
    onSave,
    testID,
    submitButtonTestID,
  }: {
    title?: string;
    children?: React.ReactNode;
    onClose?: () => void;
    onSave?: () => void;
    testID?: string;
    submitButtonTestID?: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
        <Pressable testID={submitButtonTestID} onPress={onSave}>
          <Text>Submit</Text>
        </Pressable>
        <Pressable testID="close-button" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  },
}));
jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: ({
    label,
    testID,
    ...props
  }: TextInputProps & { label?: string }) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <TextInput testID={testID} {...props} />
      </View>
    );
  },
}));
jest.mock(
  '#components/molecules/AutocompleteField/ItemAutocompleteField',
  () => ({
    ItemAutocompleteField: ({
      label,
      testID,
      error,
    }: {
      label?: string;
      testID?: string;
      error?: string;
    }) => {
      const { View, Text } = require('react-native');
      return (
        <View testID={testID}>
          <Text>{label}</Text>
          {error ? <Text>{error}</Text> : null}
        </View>
      );
    },
  }),
);
jest.mock(
  '#components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    // Renders the current `value` and offers a "pick" button that reproduces
    // the real component's call ORDER: it writes the SYMBOL through
    // `onChangeText` first, then reports the selection. A handler that writes
    // the unit's `name` back in `onUnitSelected` therefore overwrites the
    // symbol, which is the bug this stub exists to expose.
    UnitAutocompleteField: ({
      label,
      testID,
      value,
      error,
      onChangeText,
      onUnitSelected,
    }: {
      label?: string;
      testID?: string;
      value?: string;
      error?: string;
      onChangeText?: (text: string) => void;
      onUnitSelected?: (
        id: string | null,
        name: string | null,
        type?: string | null,
        symbol?: string | null,
      ) => void;
    }) => {
      const { View, Text } = require('react-native');
      return (
        <View testID={testID}>
          <Text>{label}</Text>
          <Text testID={`${testID}-value`}>{value}</Text>
          {error ? <Text>{error}</Text> : null}
          <Text
            testID={`${testID}-pick`}
            onPress={() => {
              onChangeText?.('g');
              onUnitSelected?.('unit-g', 'gram', 'WEIGHT', 'g');
            }}
          >
            pick
          </Text>
        </View>
      );
    },
  }),
);
jest.mock(
  '#components/molecules/AutocompleteField/BrandAutocompleteField',
  () => ({
    BrandAutocompleteField: ({
      label,
      testID,
    }: {
      label?: string;
      testID?: string;
    }) => {
      const { View, Text } = require('react-native');
      return (
        <View testID={testID}>
          <Text>{label}</Text>
        </View>
      );
    },
  }),
);
jest.mock(
  '#components/molecules/AutocompleteField/CategoryAutocompleteField',
  () => ({
    CategoryAutocompleteField: ({ label }: { label?: string }) => {
      const { View, Text } = require('react-native');
      return (
        <View>
          <Text>{label}</Text>
        </View>
      );
    },
  }),
);
jest.mock('#components/molecules/EditableCounter', () => ({
  // Renders `error` — validation now reports on the field, so a test asserting
  // a refusal has to be able to see it. The real component paints it as a red
  // border plus this message.
  EditableCounter: ({
    label,
    testID,
    error,
  }: {
    label?: string;
    testID?: string;
    error?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{label}</Text>
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  },
}));
jest.mock('#components/molecules/FieldRow', () => ({
  FieldRow: ({ children }: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

// Must include every field selected by `ShoppingListItemFragment` (which
// composes `ShoppingListItemDisplayFragment` + `ShoppingListItemCore`).
// `useFragment` returns `complete: true` only when the cached entity has the
// full field set, so the populate-form effect won't run with a sparse fixture.
function buildShoppingListItem(id: string) {
  return {
    __typename: 'ShoppingListItem',
    id,
    itemName: 'Milk',
    quantity: '1',
    quantityInput: '1',
    displayFormat: 'COMPACT',
    purchaseInfo: { __typename: 'PurchaseInfo', isPurchased: false },
    version: 1,
    updatedAt: '2025-01-01T00:00:00.000Z',
    category: null,
    notes: null,
    unitName: null,
    unit: null,
    sortOrder: 0,
    item: null,
    priceEstimate: null,
    source: {
      __typename: 'ShoppingListItemSource',
      isAutoAdded: false,
      autoAddReason: null,
      isFromMealPlan: false,
    },
    priority: 0,
    storeInfo: {
      __typename: 'ShoppingListItemStoreInfo',
      preferredStore: null,
    },
    brand: null,
    netWeight: null,
    netWeightUnit: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    addedBy: null,
    purchasesConnection: {
      __typename: 'PurchaseConnection',
      edges: [],
      totalCount: 0,
    },
  };
}

function buildAddItemMock(): MockedResponse {
  return {
    request: { query: AddItemToShoppingListDocument, variables: () => true },
    result: {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [
            {
              __typename: 'BatchAddShoppingListItemResult',
              index: 0,
              clientId: null,
              success: true,
              quantityIncremented: false,
              error: null,
              item: buildShoppingListItem('new-item'),
            },
          ],
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildAddItemNullMock(): MockedResponse {
  return {
    request: { query: AddItemToShoppingListDocument, variables: () => true },
    result: {
      data: {
        addItemsToShoppingList: {
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'No item',
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildAddItemNoDataMock(): MockedResponse {
  return {
    request: { query: AddItemToShoppingListDocument, variables: () => true },
    result: { data: null },
    maxUsageCount: 10,
  };
}

function buildAddItemErrorMock(): MockedResponse {
  return {
    request: { query: AddItemToShoppingListDocument, variables: () => true },
    error: new Error('Network error'),
    maxUsageCount: 10,
  };
}

function buildUpdateItemMock(): MockedResponse {
  return {
    request: { query: UpdateShoppingListItemDocument, variables: () => true },
    result: {
      data: {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          shoppingListItem: buildShoppingListItem('item1'),
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildUpdateItemNullMock(): MockedResponse {
  return {
    request: { query: UpdateShoppingListItemDocument, variables: () => true },
    result: {
      data: {
        updateShoppingListItem: {
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'No item',
        },
      },
    },
    maxUsageCount: 10,
  };
}

/** What `queueLink` emits for a queued mutation: the field present but null. */
function buildUpdateItemQueuedMock(): MockedResponse {
  return {
    request: { query: UpdateShoppingListItemDocument, variables: () => true },
    result: { data: { updateShoppingListItem: null } },
    maxUsageCount: 10,
  };
}

function buildUpdateItemErrorMock(): MockedResponse {
  return {
    request: { query: UpdateShoppingListItemDocument, variables: () => true },
    error: new Error('VERSION_CONFLICT'),
    maxUsageCount: 10,
  };
}

function buildGetShoppingListItemMock(itemId: string): MockedResponse {
  return {
    request: {
      query: GetShoppingListItemDocument,
      variables: { id: itemId },
    },
    result: {
      data: { shoppingListItem: buildShoppingListItem(itemId) },
    },
    maxUsageCount: 10,
  };
}

/**
 * Builds a hook IMPLEMENTATION (not a return value) that seeds the real hook.
 *
 * It used to return a frozen object standing in for the whole hook. That
 * cannot work now: the screen renders through `Controller control={control}`,
 * and react-hook-form's `control` has no plain-object equivalent. Seeding the
 * real hook keeps these tests honest — Save is gated by the real yup schema,
 * so a case that expects a refusal gets one for the real reason.
 *
 * Use with `.mockImplementation(...)`, not `.mockReturnValue(...)`.
 */
const mockUseShoppingListItemForm =
  (
    overrides: {
      values?: Partial<ShoppingItemFormData>;
      [key: string]: unknown;
    } = {},
  ) =>
  () => {
    const { values, ...rest } = overrides;
    const actual = jest
      .requireActual('#features/shoppingList/hooks/useShoppingListItemForm')
      .useShoppingListItemForm(values ?? {});
    const RN = require('react');
    const setFieldValue = RN.useCallback((field: string, value: unknown) => {
      mockSetFieldValue(field, value);
      actual.setFieldValue(field, value);
    }, []);
    return { ...actual, setFieldValue, ...rest };
  };

// Force the next executeWithLoadingState invocation to immediately call its
// onError callback with the supplied error. Used to exercise the catch path
// for assertions that depend on hook-side error mapping (gotcha #1: Apollo
// errorPolicy: 'all' swallows mutation errors so onError otherwise never
// fires through the natural flow).
function forceExecuteWithLoadingStateOnError(error: unknown) {
  const { executeWithLoadingState } = require('#/utils/finallyHelpers');
  executeWithLoadingState.mockImplementationOnce(
    (
      _fn: () => Promise<void>,
      _setLoading: (value: boolean) => void,
      onError?: (error: unknown) => void,
    ) => {
      onError?.(error);
    },
  );
}

describe('AddEditItem', () => {
  const addRoute = { params: { listId: 'sl1' } };
  const editRoute = { params: { listId: 'sl1', itemId: 'item1' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // `clearAllMocks` resets call records but NOT a spy's implementation, so a
  // `jest.spyOn(...).mockImplementation(...)` in one test leaked its seeded
  // form into every test after it — which is how a case expecting an empty
  // form got one pre-filled with another test's values.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders add item title', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('renders edit item title', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByText('Edit Item')).toBeTruthy();
  });

  it('shows the add-item modal testID when adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-modal')).toBeTruthy();
  });

  it('shows the edit-item modal testID when editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-modal')).toBeTruthy();
  });

  it('shows item name autocomplete field when adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-name-input')).toBeTruthy();
  });

  it('shows base input for item name when editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-name-input')).toBeTruthy();
  });

  it('shows quantity field', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('shows notes field', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('shows estimated price field', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Estimated Price')).toBeTruthy();
  });

  it('shows category field', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('shows unit field', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('shows brand and net weight fields when adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-brand-input')).toBeTruthy();
    expect(screen.getByTestId('add-item-net-weight-input')).toBeTruthy();
    expect(screen.getByTestId('add-item-net-weight-unit-picker')).toBeTruthy();
  });

  // The unit's SYMBOL is what `setFromItem` repopulates the field with and what
  // ItemDetail renders, so a pick must leave the symbol in the field. It used
  // to leave the unit's full name, because the selection handler wrote `name`
  // over the symbol `onChangeText` had just written.
  it('keeps the unit symbol in the net-weight unit field after a pick', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);

    fireEvent.press(screen.getByTestId('add-item-net-weight-unit-picker-pick'));

    expect(
      screen.getByTestId('add-item-net-weight-unit-picker-value'),
    ).toHaveTextContent('g');
  });

  it('shows brand and net weight fields when editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-brand-input')).toBeTruthy();
    expect(screen.getByTestId('edit-item-net-weight-input')).toBeTruthy();
    expect(screen.getByTestId('edit-item-net-weight-unit-picker')).toBeTruthy();
  });

  it('refuses to save a net weight that has no unit', async () => {
    // Restored at the end: `clearAllMocks` in beforeEach resets call records,
    // not a spy's return value, and the validation tests after this one render
    // with the module mock's own form state.
    const formSpy = jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Oats', quantityInput: '1', netWeight: '500' },
        }),
      );

    const user = userEvent.setup();
    renderWithApollo(<AddEditItem route={addRoute} />);
    await user.press(screen.getByTestId('add-item-submit-button'));

    // On the FIELD now, not in a modal: the message names the unit picker the
    // user has to fill in, and the alert is gone entirely.
    expect(
      await screen.findByText('Please select a unit for the net weight.'),
    ).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    formSpy.mockRestore();
  });

  it('shows correct submit button testID for adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-submit-button')).toBeTruthy();
  });

  it('shows correct submit button testID for editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-submit-button')).toBeTruthy();
  });

  it('navigates back when close button pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<AddEditItem route={addRoute} />);
    await user.press(screen.getByTestId('close-button'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('shows add-item-quantity-input testID for adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-quantity-input')).toBeTruthy();
  });

  it('shows edit-item-quantity-input testID for editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-quantity-input')).toBeTruthy();
  });

  it('shows add-item-unit-picker testID for adding', () => {
    renderWithApollo(<AddEditItem route={addRoute} />);
    expect(screen.getByTestId('add-item-unit-picker')).toBeTruthy();
  });

  it('shows edit-item-unit-picker testID for editing', () => {
    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(screen.getByTestId('edit-item-unit-picker')).toBeTruthy();
  });

  it('renders with initialItemName route param', () => {
    const routeWithInitial = {
      params: { listId: 'sl1', initialItemName: 'Bread' },
    };
    renderWithApollo(<AddEditItem route={routeWithInitial} />);
    expect(mockSetFieldValue).toHaveBeenCalledWith('itemName', 'Bread');
  });

  it('reports an empty item name on the field, not in an alert', async () => {
    const user = userEvent.setup();
    renderWithApollo(<AddEditItem route={addRoute} />);
    await user.press(screen.getByTestId('add-item-submit-button'));

    expect(await screen.findByText('Please enter an item name')).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('reports an empty quantity on the field, not in an alert', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />);
    await user.press(screen.getByTestId('add-item-submit-button'));

    expect(await screen.findByText('Please enter a quantity')).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('navigates back when edit mode and no dirty fields', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1', unit: 'pcs' },
          hasDirtyFields: false,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('calls addItem mutation for new item (success path navigates back)', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: {
            itemName: 'Milk',
            quantityInput: '2',
            unit: 'pcs',
            notes: 'whole milk',
            category: 'Dairy',
            estimatedPrice: '4.99',
          },
          buildUnitInput: jest.fn(() => ({ unitId: 'unit-1' })),
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
  });

  it('calls updateItem mutation for edit mode with dirty fields', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: {
            itemName: 'Updated Milk',
            quantityInput: '3',
            unit: 'pcs',
            category: 'Dairy',
          },
          buildDirtyInput: jest.fn(() => ({
            itemName: 'Updated Milk',
            quantity: '3',
          })),
          hasDirtyFields: true,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [
        buildGetShoppingListItemMock('item1'),
        buildUpdateItemMock(),
      ],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
  });

  it('navigates back when the edit is queued offline (null payload, no error)', async () => {
    // `UpdateShoppingListItem` is on the queue's replay allowlist, so an offline
    // edit IS saved. A payload check alone reads its null field as a refusal,
    // which alerted and stranded the user on the form.
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '3' },
          buildDirtyInput: jest.fn(() => ({ quantity: '3' })),
          hasDirtyFields: true,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [
        buildGetShoppingListItemMock('item1'),
        buildUpdateItemQueuedMock(),
      ],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('navigates back when the add is queued offline (null data, no error)', async () => {
    // Local-first (Pattern B): the item is written to cache optimistically BEFORE
    // the mutation fires. A queued create resolves with null data and no error —
    // that's success (the queue replays it), so we navigate back, NOT alert.
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemNoDataMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('shows error alert when mutation returns data but no item', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemNullMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Server error'),
      ),
    );
  });

  it('handles version conflict error in edit mode', async () => {
    const user = userEvent.setup();
    const versionError = new Error('VERSION_CONFLICT');
    forceExecuteWithLoadingStateOnError(versionError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
          buildDirtyInput: jest.fn(() => ({ itemName: 'Milk' })),
          hasDirtyFields: true,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [
        buildGetShoppingListItemMock('item1'),
        buildUpdateItemErrorMock(),
      ],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(versionError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('handles network error in error handler', async () => {
    const user = userEvent.setup();
    const networkError = {
      networkError: new Error('timeout'),
      message: 'Network error',
    };
    forceExecuteWithLoadingStateOnError(networkError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemErrorMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(networkError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('handles VALIDATION_ERROR graphQL error', async () => {
    const user = userEvent.setup();
    const validationError = {
      graphQLErrors: [
        { extensions: { code: 'VALIDATION_ERROR' }, message: 'Invalid' },
      ],
    };
    forceExecuteWithLoadingStateOnError(validationError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemErrorMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(validationError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('handles UNAUTHENTICATED graphQL error', async () => {
    const user = userEvent.setup();
    const unauthError = {
      graphQLErrors: [
        { extensions: { code: 'UNAUTHENTICATED' }, message: 'Unauthorized' },
      ],
    };
    forceExecuteWithLoadingStateOnError(unauthError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemErrorMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(unauthError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('handles generic graphQL error with message', async () => {
    const user = userEvent.setup();
    const genericError = {
      graphQLErrors: [
        { extensions: { code: 'INTERNAL_ERROR' }, message: 'Something broke' },
      ],
    };
    forceExecuteWithLoadingStateOnError(genericError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemErrorMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(genericError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('handles generic error without graphQLErrors or networkError', async () => {
    const user = userEvent.setup();
    const unknownError = new Error('Unknown');
    forceExecuteWithLoadingStateOnError(unknownError);

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemErrorMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => {
      expect(handleMutationError).toHaveBeenCalledWith(unknownError, {
        operation: 'ShoppingListItem.save',
        checks: expect.any(Array),
      });
    });
  });

  it('includes estimatedPrice in add mutation when provided (success navigates back)', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: {
            itemName: 'Steak',
            quantityInput: '1',
            unit: 'lb',
            category: 'Meat',
            estimatedPrice: '12.99',
          },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
  });

  it('populates form from existing item data in edit mode', async () => {
    const mockSetFromItem = jest.fn();

    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Bread', quantityInput: '1' },
          setFromItem: mockSetFromItem,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });

    await waitFor(() =>
      expect(mockSetFromItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'item1' }),
      ),
    );
  });

  it('shows server error alert when update returns no item data', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
          buildDirtyInput: jest.fn(() => ({ itemName: 'Milk' })),
          hasDirtyFields: true,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [
        buildGetShoppingListItemMock('item1'),
        buildUpdateItemNullMock(),
      ],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Server error'),
      ),
    );
  });

  it("names the input the server refused, in the app's own words", async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
          buildDirtyInput: jest.fn(() => ({
            netWeight: { netWeightUnitId: 'unit-g' },
          })),
          hasDirtyFields: true,
        }),
      );

    renderWithApollo(<AddEditItem route={editRoute} />, {
      operationMocks: [
        buildGetShoppingListItemMock('item1'),
        {
          request: {
            query: UpdateShoppingListItemDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateShoppingListItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message:
                  'Provide a netWeight value when specifying netWeightUnitId.',
                field: 'netWeight',
              },
            },
          },
        },
      ],
    });
    await user.press(screen.getByTestId('edit-item-submit-button'));

    // The update carries brand, netWeight, unit and storage in one call, so the
    // generic "couldn't update" does not say which was refused — `field` does.
    // Localized copy for that field, never the server's English message.
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Enter both a package size and its unit, or leave both empty.',
      ),
    );
  });

  it('navigates back on successful add', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(
        mockUseShoppingListItemForm({
          values: { itemName: 'Milk', quantityInput: '1' },
        }),
      );

    renderWithApollo(<AddEditItem route={addRoute} />, {
      operationMocks: [buildAddItemMock()],
    });
    await user.press(screen.getByTestId('add-item-submit-button'));

    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
  });

  it('does not prepopulate item name when in edit mode even with initialItemName', () => {
    jest
      .spyOn(
        require('#features/shoppingList/hooks/useShoppingListItemForm'),
        'useShoppingListItemForm',
      )
      .mockImplementation(mockUseShoppingListItemForm());

    const routeWithBoth = {
      params: { listId: 'sl1', itemId: 'item1', initialItemName: 'Bread' },
    };
    renderWithApollo(<AddEditItem route={routeWithBoth} />, {
      operationMocks: [buildGetShoppingListItemMock('item1')],
    });
    expect(mockSetFieldValue).not.toHaveBeenCalledWith('itemName', 'Bread');
  });
});
