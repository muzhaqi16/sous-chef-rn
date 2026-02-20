import React, { useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { Icon } from '#utils/iconUtils';
import { ShoppingListAvatar } from '#components/atoms/ShoppingListAvatar';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { IconLibrary } from '#/utils/iconUtils';
import { useStore } from '#store';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';

interface UseShoppingListSelectorOptions {
  listDataWithOwnership: any[];
  currentListId: string | undefined;
  setSelectedShoppingListId: (id: string) => void;
}

// Type for section headers in the grouped list
interface SectionHeader {
  _isHeader: true;
  id: string;
  title: string;
}

type ListItemOrHeader = any | SectionHeader;

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
  setSelectedShoppingListId: _setSelectedShoppingListId,
}: UseShoppingListSelectorOptions) {
  const { navigate } = useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();
  const {
    theme: { colors },
  } = useUnistyles();

  const selectorRef = useRef<ItemSelectorRef>(null);

  // Manage selector with overlay coordination
  const { handleOpenSelector: baseOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  // Open selector - data is already cached from initial mount
  const handleOpenSelector = useCallback(() => {
    baseOpenSelector();
  }, [baseOpenSelector]);

  // Group lists by home with section headers
  const groupedData = useMemo((): ListItemOrHeader[] => {
    const result: ListItemOrHeader[] = [];

    // Personal lists (no home)
    const personalLists = listDataWithOwnership.filter(
      (l: any) => !l.homeId,
    );
    if (personalLists.length > 0) {
      result.push({
        _isHeader: true,
        id: 'header-personal',
        title: 'Personal Lists',
      });
      result.push(...personalLists);
    }

    // Group by home
    const homeGroups = new Map<string, any[]>();
    listDataWithOwnership
      .filter((l: any) => l.homeId)
      .forEach((list: any) => {
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
  }, [listDataWithOwnership]);

  // PERFORMANCE: Memoize render function to prevent recreation
  const renderListItem = useCallback(
    (item: ListItemOrHeader, isSelected: boolean, onPress: () => void) => {
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

      // Render normal list item
      const list = item;
      return (
        <Pressable
          style={({pressed}) => [
            styles.selectorItemContainer,
            isSelected && styles.selectorItemSelected,
            pressed && styles.pressed,
          ]}
          onPress={onPress}
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
          {isSelected && (
            <Icon
              name="checkmark"
              size={20}
              color={colors.primary}
            />
          )}
        </Pressable>
      );
    },
    [colors],
  );

  // PERFORMANCE: Memoize actions array separately
  // Note: setOverlayOpen(false) called before navigate to ensure overlay closes immediately
  const listActions = useMemo(
    () => [
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
    ],
    [currentListId, navigate, setOverlayOpen],
  );

  // PERFORMANCE: Combine memoized parts into final config
  const listConfig: SelectorConfig<any> = useMemo(
    () => ({
      title: 'Select Shopping List',
      data: groupedData,
      selectedId: currentListId,
      onSelect: (id: string) => {
        // Skip selection for section headers
        if (id.startsWith('header-')) return;
        // Use direct store access to bypass any potential stale closure issues
        useStore.getState().setSelectedShoppingListId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading: false,
      emptyMessage: 'No shopping lists available',
      renderCustomItem: renderListItem,
      actions: listActions,
    }),
    [
      groupedData,
      currentListId,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
