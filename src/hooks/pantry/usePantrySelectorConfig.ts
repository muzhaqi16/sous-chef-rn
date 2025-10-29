import { useMemo, RefObject } from 'react';
import type { SelectorConfig, ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';
import { IconLibrary } from '#/utils/iconUtils';

interface Pantry {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface UsePantrySelectorConfigOptions {
  /**
   * Array of available pantries
   */
  pantries: any[];

  /**
   * Currently selected pantry ID
   */
  selectedPantryId?: string;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Function to update selected pantry
   */
  setSelectedPantryId: (id: string) => void;

  /**
   * Reference to the selector component
   */
  selectorRef: RefObject<ItemSelectorRef | null>;

  /**
   * Navigation function
   */
  navigate: (screen: string, params?: any) => void;
}

/**
 * Hook to create pantry selector configuration
 *
 * Provides a complete SelectorConfig for AnimatedItemSelector with:
 * - Pantry selection handling
 * - Create and edit actions
 * - Proper selector close coordination
 * - Loading state management
 *
 * @param options - Configuration options
 * @returns SelectorConfig ready for AnimatedItemSelector
 *
 * @example
 * ```typescript
 * const pantryConfig = usePantrySelectorConfig({
 *   pantries: currentHomeData?.home?.pantries || [],
 *   selectedPantryId: pantry?.id,
 *   loading,
 *   setSelectedPantryId,
 *   selectorRef,
 *   navigate,
 * });
 *
 * <AnimatedItemSelector ref={selectorRef} config={pantryConfig} />
 * ```
 */
export function usePantrySelectorConfig(
  options: UsePantrySelectorConfigOptions,
): SelectorConfig<any> {
  const {
    pantries,
    selectedPantryId,
    loading,
    setSelectedPantryId,
    selectorRef,
    navigate,
  } = options;

  return useMemo(
    () => ({
      title: 'Select Pantry',
      data: pantries,
      selectedId: selectedPantryId,
      onSelect: (id: string) => {
        setSelectedPantryId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading,
      emptyMessage: 'No pantries available',
      actions: [
        {
          icon: 'add',
          label: 'Create New Pantry',
          onPress: () => {
            selectorRef.current?.close();
            navigate('PantrySettings', { pantryId: undefined });
          },
          iconLibrary: 'MaterialIcons' as IconLibrary,
        },
        {
          icon: 'settings',
          label: 'Edit Selected Pantry',
          onPress: () => {
            selectorRef.current?.close();
            if (selectedPantryId) {
              navigate('PantrySettings', { pantryId: selectedPantryId });
            }
          },
          iconLibrary: 'MaterialIcons' as IconLibrary,
          disabled: !selectedPantryId,
        },
      ],
    }),
    [pantries, selectedPantryId, loading, setSelectedPantryId, selectorRef, navigate],
  );
}
