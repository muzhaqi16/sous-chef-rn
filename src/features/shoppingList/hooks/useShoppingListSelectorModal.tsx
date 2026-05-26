import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { Icon } from '#utils/iconUtils';
import { ShoppingListAvatar } from '#components/atoms/ShoppingListAvatar';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { IconLibrary } from '#/utils/iconUtils';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { SelectorItemContainer } from '#components/organisms/AnimatedItemSelector/SelectorItemContainer';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';
import { Text } from '#components/atoms/Text';

/** Shopping list enriched with ownership flag */
export type ShoppingListSelectorItem = ShoppingListFromQuery & {
  _isOwner: boolean;
};

interface UseShoppingListSelectorOptions {
  listDataWithOwnership: ShoppingListSelectorItem[];
  currentListId: string | undefined;
  setSelectedShoppingListId: (id: string) => void;
}

// Type for section headers in the grouped list
interface SectionHeader {
  _isHeader: true;
  id: string;
  title: string;
}

type ListItemOrHeader = ShoppingListSelectorItem | SectionHeader;

/**
 * Shopping List Selector Modal Hook
 * Extracts list selector modal logic from ShoppingListMain
 *
 * Handles:
 * - Selector ref management
 * - List config creation
 * - List actions (create, share, settings)
 * - Render list item
 * - Overlay coordination
 * - Multi-delete mode
 */
export function useShoppingListSelectorModal({
  listDataWithOwnership,
  currentListId,
}: UseShoppingListSelectorOptions) {
  const { t } = useTranslation();
  const { toListSettings, toShareList } = useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();

  const selectorRef = useRef<ItemSelectorRef>(null);

  // Manage selector with overlay coordination
  const {
    handleOpenSelector: baseOpenSelector,
    handleOverlayOpen,
    handleOverlayClose: baseOverlayClose,
  } = useSelectorManagement({
    selectorRef,
    setOverlayOpen,
  });

  // --- Delete mode state & mutation ---
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(
    () => new Set(),
  );

  // Refs mirroring volatile state — allows renderListItem to stay stable
  const isDeleteModeRef = useRef(isDeleteMode);
  const selectedForDeletionRef = useRef(selectedForDeletion);
  useEffect(() => {
    isDeleteModeRef.current = isDeleteMode;
    selectedForDeletionRef.current = selectedForDeletion;
  });
  const longPressItemRef = useRef<string | null>(null);
  const { deleteShoppingList } = useDeleteShoppingList();

  // --- Delete mode handlers ---
  const exitDeleteMode = () => {
    setIsDeleteMode(false);
    setSelectedForDeletion(new Set());
  };

  const handleLongPress = (item: ShoppingListSelectorItem) => {
    if (!item._isOwner) return;
    longPressItemRef.current = item.id;
    setIsDeleteMode(true);
    setSelectedForDeletion(new Set([item.id]));
  };

  const toggleDeleteSelection = (item: ShoppingListSelectorItem) => {
    if (!item._isOwner) return;
    if (longPressItemRef.current === item.id) {
      longPressItemRef.current = null;
      return;
    }
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const count = selectedForDeletion.size;
    if (count === 0) return;

    alertService.alert(
      t('shoppingListSelector.deleteAlertTitle', { count }),
      t('shoppingListSelector.deleteAlertMessage', { count }),
      [
        { text: t('shoppingListSelector.cancel'), style: 'cancel' },
        {
          text: t('shoppingListSelector.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = Array.from(selectedForDeletion);

            // Register parent deletions to prevent subscription race conditions
            idsToDelete.forEach(id =>
              subscriptionService.registerParentDeletion(id),
            );

            const result = await executeMutation(
              () => Promise.all(idsToDelete.map(id => deleteShoppingList(id))),
              () => {
                // Deletion failed — unregister immediately
                idsToDelete.forEach(id =>
                  subscriptionService.unregisterParentDeletion(id),
                );
                toastService.error(t('shoppingListSelector.deleteFailed'));
              },
            );

            if (!result) return;

            // Clear selection — useShoppingListSelection auto-selects the next list
            if (currentListId && idsToDelete.includes(currentListId)) {
              useStore.getState().setSelectedShoppingListId(null);
            }

            toastService.success(
              t('shoppingListSelector.deletedToast', { count }),
            );
            exitDeleteMode();
          },
        },
      ],
    );
  };

  // Wrap overlay close to also exit delete mode
  const handleOverlayClose = () => {
    baseOverlayClose();
    exitDeleteMode();
  };

  // --- Delete header right element ---
  const deleteHeaderRight = (() => {
    if (!isDeleteMode) return undefined;
    const count = selectedForDeletion.size;
    const hasSelection = count > 0;
    return (
      <View style={styles.deleteHeaderActions}>
        <Pressable
          onPress={handleDeleteSelected}
          disabled={!hasSelection}
          style={
            hasSelection ? styles.deleteButton : styles.deleteButtonDisabled
          }
        >
          <Icon
            name="trash-outline"
            size={16}
            tone={hasSelection ? 'error' : 'textSecondary'}
          />
        </Pressable>
        <Pressable onPress={exitDeleteMode}>
          <Text size="md" weight="semibold" tone="accent">
            {t('shoppingListSelector.cancel')}
          </Text>
        </Pressable>
      </View>
    );
  })();

  // Group lists by home with section headers
  const groupedData = (() => {
    const result: ListItemOrHeader[] = [];

    // Personal lists (no home)
    const personalLists = listDataWithOwnership.filter(l => !l.homeId);
    if (personalLists.length > 0) {
      result.push({
        _isHeader: true,
        id: 'header-personal',
        title: t('shoppingListSelector.personalLists'),
      });
      result.push(...personalLists);
    }

    // Group by home
    const homeGroups = new Map<string, ShoppingListSelectorItem[]>();
    listDataWithOwnership
      .filter(l => l.homeId)
      .forEach(list => {
        const homeId = list.homeId as string;
        if (!homeGroups.has(homeId)) {
          homeGroups.set(homeId, []);
        }
        homeGroups.get(homeId)!.push(list);
      });

    homeGroups.forEach((lists, homeId) => {
      const homeName =
        lists[0]?.home?.name || t('shoppingListSelector.unknownHome');
      result.push({
        _isHeader: true,
        id: `header-${homeId}`,
        title: homeName,
      });
      result.push(...lists);
    });

    return result;
  })();

  // Render function depends on isDeleteMode/selectedForDeletion so its identity
  // changes when delete state toggles, forcing SelectorItem to re-render.
  const renderListItem = (
    item: ListItemOrHeader,
    isSelected: boolean,
    onPress: () => void,
  ) => {
    // Render section header (non-selectable)
    if ('_isHeader' in item && item._isHeader) {
      return (
        <View style={styles.sectionHeader}>
          <Icon
            name={item.id === 'header-personal' ? 'person' : 'home'}
            size={14}
            tone="textTertiary"
          />
          <Text
            size="xs"
            weight="semibold"
            tone="tertiary"
            style={styles.sectionHeaderText}
          >
            {item.title}
          </Text>
        </View>
      );
    }

    // After the header guard above, item is always a ShoppingListSelectorItem
    const list = item as ShoppingListSelectorItem;

    // Delete mode rendering — read from state for re-render on toggle
    if (isDeleteMode) {
      const isSelectedForDelete = selectedForDeletion.has(list.id);
      const canDelete = !!list._isOwner;

      return (
        <SelectorItemContainer
          state={
            isSelectedForDelete
              ? 'delete-selected'
              : !canDelete
              ? 'disabled'
              : 'default'
          }
          compact
          onPress={() => toggleDeleteSelection(list)}
          disabled={!canDelete}
        >
          <Icon
            name={isSelectedForDelete ? 'checkbox' : 'square-outline'}
            size={20}
            tone={isSelectedForDelete ? 'error' : 'textSecondary'}
          />
          <ShoppingListAvatar list={list} size={32} />
          <View style={styles.selectorItemInfo}>
            <Text size="md" weight="semibold">
              {list.name}
            </Text>
            {!canDelete && (
              <Text size="xs" tone="secondary">
                {t('shoppingListSelector.cannotDeleteShared')}
              </Text>
            )}
          </View>
        </SelectorItemContainer>
      );
    }

    // Normal mode rendering
    return (
      <SelectorItemContainer
        state={isSelected ? 'selected' : 'default'}
        compact
        onPress={onPress}
        onLongPress={() => handleLongPress(list)}
      >
        <ShoppingListAvatar list={list} size={32} />
        <View style={styles.selectorItemInfo}>
          <Text size="md" weight="semibold">
            {list.name}
          </Text>
          {!list._isOwner && (
            <Text size="xs" tone="secondary">
              {t('shoppingListSelector.sharedBy', {
                name:
                  list.ownerships?.[0]?.user?.profile?.displayName ||
                  list.ownerships?.[0]?.user?.email ||
                  t('shoppingListSelector.sharedBySomeone'),
              })}
            </Text>
          )}
        </View>
        {list.totalItems > 0 && (
          <Text size="xs" tone="secondary">
            {t('shoppingListSelector.itemsRemaining', {
              remaining: list.totalItems - list.completedItems,
              total: list.totalItems,
            })}
          </Text>
        )}
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </SelectorItemContainer>
    );
  };

  // PERFORMANCE: Memoize actions array separately
  // Note: setOverlayOpen(false) called before navigate to ensure overlay closes immediately
  const listActions = [
    {
      icon: 'add',
      label: t('shoppingListSelector.createNewList'),
      onPress: () => {
        setOverlayOpen(false);
        selectorRef.current?.close();
        toListSettings();
      },
      iconLibrary: 'Ionicons' as IconLibrary,
    },
    ...(currentListId
      ? [
          {
            icon: 'share-outline',
            label: t('shoppingListSelector.shareCurrentList'),
            onPress: () => {
              setOverlayOpen(false);
              selectorRef.current?.close();
              toShareList({ listId: currentListId });
            },
            iconLibrary: 'Ionicons' as IconLibrary,
          },
          {
            icon: 'settings-outline',
            label: t('shoppingListSelector.listSettings'),
            onPress: () => {
              setOverlayOpen(false);
              selectorRef.current?.close();
              toListSettings({ listId: currentListId });
            },
            iconLibrary: 'Ionicons' as IconLibrary,
          },
        ]
      : []),
  ];

  // extraData signals FlashList to re-render items when delete state changes
  const selectorExtraData = { isDeleteMode, selectedForDeletion };

  // PERFORMANCE: Stable onSelect — reads volatile state from refs + store
  const onSelect = (id: string) => {
    if (isDeleteModeRef.current) return;
    // Skip selection for section headers
    if (id.startsWith('header-')) return;
    // Use direct store access to bypass any potential stale closure issues
    useStore.getState().setSelectedShoppingListId(id);
    selectorRef.current?.close();
  };

  // PERFORMANCE: Combine memoized parts into final config
  const listConfig: SelectorConfig<ListItemOrHeader> = {
    title: selectorExtraData.isDeleteMode
      ? t('shoppingListSelector.deleteModeTitle', {
          count: selectorExtraData.selectedForDeletion.size,
        })
      : t('shoppingListSelector.title'),
    data: groupedData,
    selectedId: currentListId,
    onSelect,
    displayProperty: 'id', // unused — renderCustomItem handles all rendering
    loading: false,
    emptyMessage: t('shoppingListSelector.emptyMessage'),
    renderCustomItem: renderListItem,
    actions: listActions,
    headerRight: deleteHeaderRight,
    extraData: selectorExtraData,
    maxVisibleItems: 5,
  };

  return {
    selectorRef,
    listConfig,
    handleOpenSelector: baseOpenSelector,
    handleOverlayOpen,
    handleOverlayClose,
  };
}

// Styles for the selector items
const styles = StyleSheet.create(theme => ({
  selectorItemInfo: {
    flex: 1,
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  sectionHeaderText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
