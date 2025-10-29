import React, { useMemo, RefObject } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { SelectorConfig, ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';
import { ShoppingListAvatar } from '#components/atoms';
import { Icon } from '#utils';
import { IconLibrary } from '#/utils/iconUtils';
import { isShoppingListOwner } from '#utils/ownershipHelpers';

interface ShoppingList {
  id: string;
  name: string;
  isDefault?: boolean;
  ownerships?: Array<{
    user?: {
      profile?: {
        displayName?: string | null;
      } | null;
      email?: string;
    } | null;
  }> | null;
}

interface UseShoppingListSelectorOptions {
  /**
   * Array of shopping lists
   */
  lists: any[];

  /**
   * Currently selected list ID
   */
  currentListId?: string;

  /**
   * Current user ID for ownership detection
   */
  userId?: string;

  /**
   * Function to update selected list
   */
  setSelectedListId: (id: string) => void;

  /**
   * Reference to the selector component
   */
  selectorRef: RefObject<ItemSelectorRef | null>;

  /**
   * Navigation function
   */
  navigate: (screen: string, params?: any) => void;

  /**
   * Theme colors
   */
  colors: {
    primary: string;
  };

  /**
   * Styles for custom rendering
   */
  styles: {
    selectorItemContainer: any;
    selectorItemSelected: any;
    selectorItemInfo: any;
    selectorItemName: any;
    selectorItemSubtext: any;
  };
}

/**
 * Hook to create shopping list selector configuration
 *
 * Provides a complete SelectorConfig for AnimatedItemSelector with:
 * - Custom rendering for list items with avatars
 * - Ownership detection and display
 * - Dynamic action buttons (create, share, settings)
 * - Proper selector close coordination
 *
 * @param options - Configuration options
 * @returns SelectorConfig ready for AnimatedItemSelector
 *
 * @example
 * ```typescript
 * const listConfig = useShoppingListSelectorConfig({
 *   lists,
 *   currentListId,
 *   userId: user?.id,
 *   setSelectedListId,
 *   selectorRef,
 *   navigate,
 *   colors,
 *   styles,
 * });
 *
 * <AnimatedItemSelector ref={selectorRef} config={listConfig} />
 * ```
 */
export function useShoppingListSelectorConfig(
  options: UseShoppingListSelectorOptions,
): SelectorConfig<any> {
  const {
    lists,
    currentListId,
    userId,
    setSelectedListId,
    selectorRef,
    navigate,
    colors,
    styles,
  } = options;

  return useMemo(
    () => ({
      title: 'Select Shopping List',
      data: lists.map(list => {
        const isOwner = isShoppingListOwner(list, userId);
        return {
          ...list,
          // Add computed properties for display
          _isOwner: isOwner,
        };
      }),
      selectedId: currentListId,
      onSelect: (id: string) => {
        setSelectedListId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading: false,
      emptyMessage: 'No shopping lists available',
      // Custom render for list items with avatar and role badge
      renderCustomItem: (
        list: any,
        isSelected: boolean,
        onPress: () => void,
      ) => (
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
      actions: [
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
                  navigate('ListSettings', {
                    listId: currentListId,
                  });
                },
                iconLibrary: 'MaterialIcons' as IconLibrary,
              },
            ]
          : []),
      ],
    }),
    [
      lists,
      currentListId,
      userId,
      setSelectedListId,
      selectorRef,
      navigate,
      colors,
      styles,
    ],
  );
}
