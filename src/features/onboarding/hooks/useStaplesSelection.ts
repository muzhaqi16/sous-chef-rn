import { useState } from 'react';
import type { TranslationKey } from '#/i18n';
import {
  AcquisitionMethod,
  ItemCondition,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { executeWriteWithFinally } from '#/utils/finallyHelpers';
import { useSelectedPantryId } from '#store/useAppStore';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';
import { useOnboardingItems } from './useOnboardingItems';
import { useSelectableItems } from './useSelectableItems';

/** Where a staple is kept, each a group of its own; the rest is the pantry. */
const STAPLE_GROUPS: readonly {
  state: StorageState;
  labelKey: TranslationKey;
}[] = [
  {
    state: StorageState.Refrigerated,
    labelKey: 'storageStateShort.REFRIGERATED',
  },
  { state: StorageState.Frozen, labelKey: 'storageStateShort.FROZEN' },
  { state: StorageState.Ambient, labelKey: 'storageStateShort.AMBIENT' },
];

const groupOf = (state: StorageState): StorageState =>
  state === StorageState.Refrigerated || state === StorageState.Frozen
    ? state
    : StorageState.Ambient;

/** What the staples can show: their list, or why it is not there yet. */
export type StaplesState = 'loading' | 'failed' | 'unread' | 'ready';

/**
 * The staples the kitchen step offers and the pantry's picks among them. A
 * food the pantry already holds starts picked; `save` adds the new picks,
 * takes out the ones unpicked, and counts what landed for the summary.
 */
export function useStaplesSelection() {
  const pantryId = useSelectedPantryId();
  const { recordStapleItems } = useRecordOnboardingProgress();
  const staples = useOnboardingItems();
  const pantry = usePantryItemSelection(pantryId);
  const [saving, setSaving] = useState(false);

  const { items, selectedItems, toggleItem, isMaxReached } = useSelectableItems(
    {
      initialItems: staples.items.map(item => ({
        ...item,
        selected: pantry.existingCatalogIds.has(item.id),
      })),
      maxSelection: 100,
    },
  );

  // Gate on the absence of data, never `loading`, which is true on every
  // mount. Unread, a held food would show unpicked and be added twice.
  const state: StaplesState =
    (staples.loading && !staples.hasLoaded) ||
    (pantry.loading && !pantry.hasLoaded)
      ? 'loading'
      : staples.failed
      ? 'failed'
      : pantry.state === 'error' || pantry.state === 'offline'
      ? 'unread'
      : 'ready';

  // Only a staple shown here may be taken out: the pantry also holds a
  // receipt's items and foods the list leaves out. Until both reads answer,
  // nothing is a change.
  const ready = state === 'ready';
  const selectedIds = new Set(selectedItems.map(item => item.id));
  const heldStaples = items.flatMap(item =>
    pantry.existingCatalogIds.has(item.id) ? [item.id] : [],
  );
  const toAdd = ready
    ? selectedItems.filter(item => !pantry.existingCatalogIds.has(item.id))
    : [];
  const toRemove = ready ? heldStaples.filter(id => !selectedIds.has(id)) : [];

  const save = (): Promise<void> =>
    executeWriteWithFinally(
      async () => {
        const [added, removed] = await Promise.all([
          Promise.all(
            toAdd.map(item =>
              // No unit: the server picks the one the pantry or the food
              // is usually tracked in, never a recipe measure.
              pantry.addItem(item.name, {
                item: { id: item.id },
                quantity: null,
                storage: {
                  storageState: groupOf(item.storageState),
                  condition: ItemCondition.Good,
                },
                purchase: { acquisitionMethod: AcquisitionMethod.Purchased },
              }),
            ),
          ),
          Promise.all(
            toRemove.flatMap(catalogId => {
              const rowId = pantry.existingItemMap.get(catalogId);
              return rowId ? [pantry.removeItem(rowId)] : [];
            }),
          ),
        ]);
        // A refused staple never joins the summary's count; one taken out
        // leaves it.
        recordStapleItems(
          added.filter(({ status }) => status === 'added').length -
            removed.filter(Boolean).length,
        );
      },
      setSaving,
      error => {
        errorService.reportError(error, {
          operation: 'useStaplesSelection.save',
        });
      },
    );

  return {
    state,
    groups: STAPLE_GROUPS.map(group => ({
      ...group,
      items: items.filter(item => groupOf(item.storageState) === group.state),
    })),
    selectedCount: selectedItems.length,
    toggle: toggleItem,
    isMaxReached,
    /** New picks to add, or held ones to take out. */
    hasChanges: toAdd.length > 0 || toRemove.length > 0,
    /** Nothing from the staples is in the pantry yet. */
    isFirstVisit: heldStaples.length === 0,
    saving,
    save,
    retry: () => {
      if (staples.failed) staples.refetch();
      else void pantry.refetch();
    },
  };
}
