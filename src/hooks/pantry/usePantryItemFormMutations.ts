import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useUpdatePantryItemQuantityMutation,
  useGetUnitBySymbolLazyQuery,
  StorageState,
  PantryItemFragment,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';

// ============================================
// Types
// ============================================

export interface UnitSelection {
  id: string | null;
  name: string | null;
  symbol: string | null;
  type: string | null;
}

export const emptyUnitSelection: UnitSelection = {
  id: null,
  name: null,
  symbol: null,
  type: null,
};

/**
 * Minimal interface for form data - accepts any object with these fields.
 * This avoids duplicating the form's data type while ensuring type safety.
 */
interface FormDataInput {
  itemName?: string;
  selectedItemId?: string;
  brand?: string;
  quantityInput?: string;
  unit: string;
  itemWeight?: number;
  weightUnit?: string;
  minQuantity?: string;
  restockQuantity?: string;
  storageState: StorageState;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
  tags?: string[];
}

interface CreatePantryItemParams<T extends FormDataInput = FormDataInput> {
  input: T;
  pantryId: string;
  quantityValue: number;
  unitId: string | null;
  selectedLocationId: string | null;
  selectedCategoryId: string | null;
  selectedWeightUnitId: string | null;
}

interface UpdatePantryItemParams<T extends FormDataInput = FormDataInput> {
  itemId: string;
  input: T;
  currentItem: PantryItemFragment;
  dirtyFields: Record<string, boolean>;
  quantityValue: number;
  unitId: string | null;
  trackingUnit: UnitSelection;
  weightUnit: UnitSelection;
  selectedLocationId: string | null;
}

interface UsePantryItemFormMutationsOptions {
  pantryId: string | undefined;
  onSuccess?: () => void;
  refetch?: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build optimistic Unit object for cache updates.
 * Includes all Unit fields from PantryItemFragment to prevent cache warnings.
 */
function buildOptimisticUnit(
  newUnit: UnitSelection,
  currentUnit?: PantryItemFragment['unit'] | null,
): PantryItemFragment['unit'] | null {
  if (!newUnit.id) return null;

  // Cast type to UnitType if it's a string, fallback to COUNT
  const unitType = (newUnit.type ||
    currentUnit?.type ||
    'COUNT') as import('#generated').UnitType;

  return {
    __typename: 'Unit',
    id: newUnit.id,
    symbol: newUnit.symbol || currentUnit?.symbol || '',
    name: newUnit.name || currentUnit?.name || newUnit.symbol || '',
    type: unitType,
    // Preserve existing fields from current unit or use sensible defaults
    isMetric: currentUnit?.isMetric ?? false,
    baseUnitId: currentUnit?.baseUnitId ?? null,
    conversionFactor: currentUnit?.conversionFactor ?? 1,
    isCommon: currentUnit?.isCommon ?? false,
    displayAsFraction: currentUnit?.displayAsFraction ?? false,
    minPrecision: currentUnit?.minPrecision ?? 0,
    autoConvertThreshold: currentUnit?.autoConvertThreshold ?? null,
  };
}

/**
 * Build optimistic Unit object for packageWeightUnit (has fewer fields).
 */
function buildOptimisticWeightUnit(
  newUnit: UnitSelection,
  currentUnit?: {
    id?: string;
    name?: string;
    symbol?: string;
    type?: string;
  } | null,
): {
  __typename: 'Unit';
  id: string;
  name: string;
  symbol: string;
  type: string | null;
} | null {
  if (!newUnit.id) return null;

  return {
    __typename: 'Unit',
    id: newUnit.id,
    symbol: newUnit.symbol || currentUnit?.symbol || '',
    name: newUnit.name || currentUnit?.name || newUnit.symbol || '',
    type: newUnit.type || currentUnit?.type || null,
  };
}

/**
 * Build dirty input for update mutation (only changed fields)
 */
function buildDirtyUpdateInput(
  data: FormDataInput,
  dirtyFields: Record<string, boolean>,
  locationId: string | null,
  weightUnitId: string | null,
): Record<string, any> {
  const input: Record<string, any> = {};

  if (dirtyFields.storageState) {
    input.storageState = data.storageState;
  }

  if (dirtyFields.location && locationId) {
    input.storageLocationId = locationId;
  }

  if (dirtyFields.expirationDate) {
    input.expiresAt = data.expirationDate?.toISOString() ?? null;
  }

  if (dirtyFields.notes) {
    input.storageNotes = data.notes;
  }

  if (dirtyFields.tags) {
    input.tags = data.tags || [];
  }

  // Weight changes - MUST send both packageWeight and packageWeightUnitId together
  if (dirtyFields.itemWeight || dirtyFields.weightUnit) {
    input.packageWeight = data.itemWeight ?? null;
    // Always send packageWeightUnitId when weight fields are dirty
    // This allows clearing both weight and unit by sending null
    input.packageWeightUnitId = weightUnitId ?? null;
  }

  if (dirtyFields.minQuantity) {
    input.minQuantity = data.minQuantity ? parseFloat(data.minQuantity) : null;
  }

  if (dirtyFields.restockQuantity) {
    input.restockQuantity = data.restockQuantity
      ? parseFloat(data.restockQuantity)
      : null;
  }

  return input;
}

/**
 * Parse fractional quantity input (e.g., "1 1/4", "3/4", "1.5")
 */
export function parseQuantityInput(input: string): number | null {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.includes('/')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length === 2) {
        // Mixed number like "1 1/4"
        const whole = parseInt(parts[0]);
        const [num, den] = parts[1].split('/').map(Number);
        return whole + num / den;
      } else {
        // Simple fraction like "3/4"
        const [num, den] = trimmed.split('/').map(Number);
        return num / den;
      }
    } else {
      return parseFloat(trimmed);
    }
  } catch {
    return null;
  }
}

// ============================================
// Main Hook
// ============================================

export function usePantryItemFormMutations({
  pantryId,
  onSuccess,
  refetch,
}: UsePantryItemFormMutationsOptions) {
  const { handleApolloError } = useErrorHandler();

  // Unit lookup query
  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'cache-first',
  });

  // Create mutation with cache update
  const [createMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data: mutationData }) => {
      if (!mutationData?.createPantryItem || !pantryId) return;

      try {
        const pantryCacheId = cache.identify({
          __typename: 'Pantry',
          id: pantryId,
        });

        if (!pantryCacheId) return;

        cache.modify({
          id: pantryCacheId,
          fields: {
            itemsConnection(
              existingConnection = {},
              { readField, toReference },
            ) {
              const newItemRef = toReference(mutationData.createPantryItem);
              const existingEdges = existingConnection?.edges || [];

              const exists = existingEdges.some(
                (edge: any) =>
                  readField('id', edge?.node) ===
                  mutationData.createPantryItem.id,
              );

              if (exists) return existingConnection;

              const newEdge = {
                __typename: 'PantryItemEdge',
                node: newItemRef,
                cursor: '',
              };

              return {
                ...existingConnection,
                edges: [newEdge, ...existingEdges],
                totalCount: (existingConnection?.totalCount || 0) + 1,
              };
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Create Pantry Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Update mutation (for non-quantity fields)
  const [updateMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch?.() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      const { message } = handleApolloError(error, {
        operation: 'Update Pantry Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Update quantity mutation (separate endpoint for quantity/unit changes)
  const [updateQuantityMutation] = useUpdatePantryItemQuantityMutation({
    errorPolicy: 'all',
    onError: error => {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch?.() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      const { message } = handleApolloError(error, {
        operation: 'Update Quantity',
      });
      Alert.alert('Error', message);
    },
  });

  /**
   * Resolve unit ID from symbol if not already set
   */
  const resolveUnitId = useCallback(
    async (
      currentUnitId: string | null,
      unitSymbol: string,
    ): Promise<string | null> => {
      if (currentUnitId) return currentUnitId;
      if (!unitSymbol.trim()) return null;

      const result = await unitQuery({
        variables: { symbol: unitSymbol.trim() },
      });
      return result.data?.unitBySymbol?.id || null;
    },
    [unitQuery],
  );

  /**
   * Create a new pantry item
   */
  const createPantryItem = useCallback(
    async ({
      input,
      pantryId: targetPantryId,
      quantityValue,
      unitId,
      selectedLocationId,
      selectedCategoryId,
      selectedWeightUnitId,
    }: CreatePantryItemParams): Promise<boolean> => {
      if (!input.itemName?.trim()) {
        Alert.alert('Error', 'Please enter an item name');
        return false;
      }

      const storageLocationInput = selectedLocationId
        ? { storageLocationId: selectedLocationId }
        : input.location.trim()
        ? { storageLocationName: input.location.trim() }
        : {};

      const baseInput = {
        pantryId: targetPantryId,
        unitId: unitId || '',
        initialQuantity: quantityValue,
        storageState: input.storageState,
        expiresAt: input.expirationDate?.toISOString() || null,
        storageNotes: input.notes.trim() || null,
        minQuantity: input.minQuantity
          ? parseFloat(input.minQuantity)
          : undefined,
        restockQuantity: input.restockQuantity
          ? parseFloat(input.restockQuantity)
          : undefined,
        ...storageLocationInput,
      };

      let mutationInput: any;

      if (input.selectedItemId) {
        // Linking to existing catalog item
        const weightInput =
          input.itemWeight && selectedWeightUnitId
            ? {
                packageWeight: input.itemWeight,
                packageWeightUnitId: selectedWeightUnitId,
              }
            : {};

        mutationInput = {
          ...baseInput,
          itemId: input.selectedItemId,
          ...weightInput,
        };
      } else {
        // Creating new item
        const categoryInput = selectedCategoryId
          ? { itemCategory: selectedCategoryId }
          : input.category.trim()
          ? { itemCategory: input.category.trim() }
          : {};

        const weightInput =
          input.itemWeight && selectedWeightUnitId
            ? {
                itemNetWeight: input.itemWeight,
                itemDisplayUnitId: selectedWeightUnitId,
              }
            : {};

        mutationInput = {
          ...baseInput,
          itemName: input.itemName.trim(),
          itemDescription: input.notes.trim() || null,
          itemBrand: input.brand?.trim() || null,
          ...categoryInput,
          ...weightInput,
        };
      }

      const result = await createMutation({
        variables: { input: mutationInput },
      });

      if (result.data?.createPantryItem) {
        onSuccess?.();
        return true;
      }

      return false;
    },
    [createMutation, onSuccess],
  );

  /**
   * Update an existing pantry item
   */
  const updatePantryItem = useCallback(
    async ({
      itemId,
      input,
      currentItem,
      dirtyFields,
      quantityValue,
      unitId,
      trackingUnit,
      weightUnit,
      selectedLocationId,
    }: UpdatePantryItemParams): Promise<boolean> => {
      const quantityOrUnitChanged =
        dirtyFields.quantityInput || dirtyFields.unit;

      // Handle quantity/unit changes with dedicated mutation
      if (quantityOrUnitChanged) {
        const newQuantity = parseFloat(
          input.quantityInput || quantityValue.toString(),
        );

        // Fire mutation asynchronously - don't await to allow immediate navigation
        updateQuantityMutation({
          variables: {
            pantryItemId: itemId,
            quantity: input.quantityInput || quantityValue.toString(),
            unitId: unitId,
            version: currentItem.version ?? undefined,
          },
          optimisticResponse: {
            __typename: 'Mutation',
            updatePantryItemQuantity: enhanceWithVersion(currentItem as any, {
              currentQuantity: newQuantity,
              unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
              unitId: unitId || currentItem.unitId,
              unitName: input.unit || currentItem.unitName,
            }),
          },
        }).catch(error => {
          console.error('Quantity update failed:', error);
          // Error already handled by mutation's onError
        });
      }

      // Build input for other dirty fields
      const updateInput = buildDirtyUpdateInput(
        input,
        dirtyFields,
        selectedLocationId,
        weightUnit.id,
      );

      // Update other fields if any changed
      if (Object.keys(updateInput).length > 0) {
        const optimisticInput: Record<string, any> = { ...updateInput };

        // Include full packageWeightUnit object for cache
        if (updateInput.packageWeightUnitId) {
          optimisticInput.packageWeightUnit = buildOptimisticWeightUnit(
            weightUnit,
            currentItem.packageWeightUnit,
          );
        }

        // Fire mutation asynchronously - don't await to allow immediate navigation
        updateMutation({
          variables: { id: itemId, input: updateInput },
          optimisticResponse: {
            __typename: 'Mutation',
            updatePantryItem: enhanceWithVersion(
              currentItem as any,
              optimisticInput,
            ),
          },
        }).catch(error => {
          console.error('Pantry item update failed:', error);
          // Error already handled by mutation's onError
        });
      }

      onSuccess?.();
      return true;
    },
    [updateQuantityMutation, updateMutation, onSuccess],
  );

  return {
    // Mutations
    createPantryItem,
    updatePantryItem,
    resolveUnitId,

    // Helpers
    parseQuantityInput,
  };
}
