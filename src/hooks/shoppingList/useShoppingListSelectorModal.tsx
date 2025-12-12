import React, { useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks';
import { useTabBarActions } from '#context';
import { Icon } from '#utils';
import { ShoppingListAvatar } from '#components/atoms';
import { useSelectorManagement } from '#hooks/ui';
import { IconLibrary } from '#/utils/iconUtils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';

interface UseShoppingListSelectorOptions {
  listDataWithOwnership: any[];
  currentListId: string | undefined;
  setSelectedShoppingListId: (id: string) => void;
}

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
 */
export function useShoppingListSelectorModal({
  listDataWithOwnership,
  currentListId,
  setSelectedShoppingListId,
}: UseShoppingListSelectorOptions) {
  const { navigate } = useAppNavigation();
  const { setOverlayOpen } = useTabBarActions();
  const {
    theme: { colors },
  } = useUnistyles();

  const selectorRef = useRef<ItemSelectorRef>(null);

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  // PERFORMANCE: Memoize render function to prevent recreation
  const renderListItem = useCallback(
    (list: any, isSelected: boolean, onPress: () => void) => (
      <TouchableOpacity
        style={[
          styles.selectorItemContainer,
          isSelected && styles.selectorItemSelected,
        ]}
        onPress={onPress}
      >
        <ShoppingListAvatar list={list} size={40} />
        <View style={styles.selectorItemInfo}>
          <Text style={styles.selectorItemName}>{list.name}</Text>
          <Text style={styles.selectorItemSubtext}>
            {list._isOwner
              ? 'You own this list'
              : `Shared by ${
                  list.ownerships?.[0]?.user?.profile?.displayName ||
                  list.ownerships?.[0]?.user?.email ||
                  'someone'
                }`}
          </Text>
        </View>
        {isSelected && (
          <Icon
            name="check"
            size={20}
            color={colors.primary}
            library="MaterialIcons"
          />
        )}
      </TouchableOpacity>
    ),
    [colors],
  );

  // PERFORMANCE: Memoize actions array separately
  const listActions = useMemo(
    () => [
      {
        icon: 'add',
        label: 'Create New List',
        onPress: () => {
          selectorRef.current?.close();
          navigate('ListSettings');
        },
        iconLibrary: 'MaterialIcons' as IconLibrary,
      },
      ...(currentListId
        ? [
            {
              icon: 'share',
              label: 'Share Current List',
              onPress: () => {
                selectorRef.current?.close();
                navigate('ShareList', { listId: currentListId });
              },
              iconLibrary: 'MaterialIcons' as IconLibrary,
            },
            {
              icon: 'settings',
              label: 'List Settings',
              onPress: () => {
                selectorRef.current?.close();
                navigate('ListSettings', { listId: currentListId });
              },
              iconLibrary: 'MaterialIcons' as IconLibrary,
            },
          ]
        : []),
    ],
    [currentListId, navigate],
  );

  // PERFORMANCE: Combine memoized parts into final config
  const listConfig: SelectorConfig<any> = useMemo(
    () => ({
      title: 'Select Shopping List',
      data: listDataWithOwnership,
      selectedId: currentListId,
      onSelect: (id: string) => {
        setSelectedShoppingListId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading: false,
      emptyMessage: 'No shopping lists available',
      renderCustomItem: renderListItem,
      actions: listActions,
    }),
    [
      listDataWithOwnership,
      currentListId,
      setSelectedShoppingListId,
      renderListItem,
      listActions,
    ],
  );

  return {
    selectorRef,
    listConfig,
    handleOpenSelector,
    handleOverlayOpen,
    handleOverlayClose,
  };
}

// Styles for the selector items
const styles = StyleSheet.create(theme => ({
  selectorItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectorItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  selectorItemInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  selectorItemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  selectorItemSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
