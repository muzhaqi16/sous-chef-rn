import React, { useRef, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { Icon } from '#utils/iconUtils';
import { ShoppingListAvatar } from '#components/atoms/ShoppingListAvatar';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { IconLibrary } from '#/utils/iconUtils';
import { useStore } from '#store';
import { useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '../../graphql/operations/shoppingList/shoppingList.generated';
import { createRemoveFromQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useErrorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

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
  const { navigate } = useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();
  const {
    theme: { colors },
  } = useUnistyles();

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
  const { handleApolloError } = useErrorService();

  const [deleteList] = useMutation(DeleteShoppingListDocument, {
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Shopping List',
      });
      toastService.error(message);
    },
    update: (cache, { data }, { variables }) => {
      if (!data?.deleteShoppingList?.shoppingList || !variables) return;

      executeCacheUpdate(() => {
        const removeFromShoppingListsCache =
          createRemoveFromQueryConnectionUpdater(
            'shoppingLists',
            'ShoppingList',
          );
        removeFromShoppingListsCache(cache, variables.id, { evictItem: true });
      }, 'Cache update failed for deleteList:');
    },
  });

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
      `Delete ${count} List${count > 1 ? 's' : ''}`,
      `Are you sure you want to delete ${
        count > 1 ? 'these lists' : 'this list'
      }? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = Array.from(selectedForDeletion);

            // Register parent deletions to prevent subscription race conditions
            idsToDelete.forEach(id =>
              subscriptionService.registerParentDeletion(id),
            );

            const result = await executeMutation(
              () =>
                Promise.all(
                  idsToDelete.map(id => deleteList({ variables: { id } })),
                ),
              () => {
                // Deletion failed — unregister immediately
                idsToDelete.forEach(id =>
                  subscriptionService.unregisterParentDeletion(id),
                );
                toastService.error('Failed to delete lists');
              },
            );

            if (!result) return;

            // Clear selection — useShoppingListSelection auto-selects the next list
            if (currentListId && idsToDelete.includes(currentListId)) {
              useStore.getState().setSelectedShoppingListId(null);
            }

            toastService.success(
              `Deleted ${count} list${count > 1 ? 's' : ''}`,
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
            color={hasSelection ? colors.error : colors.textSecondary}
          />
        </Pressable>
        <Pressable onPress={exitDeleteMode}>
          <Text style={styles.cancelText}>Cancel</Text>
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
        title: 'Personal Lists',
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
      const homeName = lists[0]?.home?.name || 'Unknown Home';
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
            name={item.title === 'Personal Lists' ? 'person' : 'home'}
            size={14}
            color={colors.textTertiary}
          />
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
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
        <Pressable
          style={({ pressed }) => [
            styles.selectorItemContainer,
            isSelectedForDelete && styles.selectorItemDeleteSelected,
            !canDelete && styles.selectorItemDisabled,
            pressed && canDelete && styles.pressed,
          ]}
          onPress={() => toggleDeleteSelection(list)}
          disabled={!canDelete}
        >
          <Icon
            name={isSelectedForDelete ? 'checkbox' : 'square-outline'}
            size={20}
            color={isSelectedForDelete ? colors.error : colors.textSecondary}
          />
          <ShoppingListAvatar list={list} size={32} />
          <View style={styles.selectorItemInfo}>
            <Text style={styles.selectorItemName}>{list.name}</Text>
            {!canDelete && (
              <Text style={styles.selectorItemSubtext}>
                Cannot delete (shared)
              </Text>
            )}
          </View>
        </Pressable>
      );
    }

    // Normal mode rendering
    return (
      <Pressable
        style={({ pressed }) => [
          styles.selectorItemContainer,
          isSelected && styles.selectorItemSelected,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        onLongPress={() => handleLongPress(list)}
      >
        <ShoppingListAvatar list={list} size={32} />
        <View style={styles.selectorItemInfo}>
          <Text style={styles.selectorItemName}>{list.name}</Text>
          {!list._isOwner && (
            <Text style={styles.selectorItemSubtext}>
              {`Shared by ${
                list.ownerships?.[0]?.user?.profile?.displayName ||
                list.ownerships?.[0]?.user?.email ||
                'someone'
              }`}
            </Text>
          )}
        </View>
        {list.totalItems > 0 && (
          <Text style={styles.selectorItemCount}>
            {list.totalItems - list.completedItems} of {list.totalItems}
          </Text>
        )}
        {!!isSelected && (
          <Icon name="checkmark" size={20} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  // PERFORMANCE: Memoize actions array separately
  // Note: setOverlayOpen(false) called before navigate to ensure overlay closes immediately
  const listActions = [
    {
      icon: 'add',
      label: 'Create New List',
      onPress: () => {
        setOverlayOpen(false);
        selectorRef.current?.close();
        navigate('ListSettings');
      },
      iconLibrary: 'Ionicons' as IconLibrary,
    },
    ...(currentListId
      ? [
          {
            icon: 'share-outline',
            label: 'Share Current List',
            onPress: () => {
              setOverlayOpen(false);
              selectorRef.current?.close();
              navigate('ShareList', { listId: currentListId });
            },
            iconLibrary: 'Ionicons' as IconLibrary,
          },
          {
            icon: 'settings-outline',
            label: 'List Settings',
            onPress: () => {
              setOverlayOpen(false);
              selectorRef.current?.close();
              navigate('ListSettings', { listId: currentListId });
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
      ? `${selectorExtraData.selectedForDeletion.size} Selected`
      : 'Select Shopping List',
    data: groupedData,
    selectedId: currentListId,
    onSelect,
    displayProperty: 'id', // unused — renderCustomItem handles all rendering
    loading: false,
    emptyMessage: 'No shopping lists available',
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
  selectorItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectorItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  selectorItemDeleteSelected: {
    backgroundColor: theme.colors.errorLight,
    borderColor: theme.colors.error,
  },
  selectorItemDisabled: {
    opacity: 0.5,
  },
  selectorItemInfo: {
    flex: 1,
    gap: 2,
  },
  selectorItemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  selectorItemSubtext: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  selectorItemCount: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  sectionHeaderText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textTertiary,
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
  cancelText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
