import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Title } from '#components/atoms/Title';
import {
  BottomSheetSearchBar,
  type BottomSheetSearchBarRef,
} from '#components/molecules/BottomSheetSearchBar';
import { IngredientSelectionProvider } from '../../context/IngredientSelectionContext';
import {
  renderIngredientItem,
  ingredientKeyExtractor,
} from './IngredientListItem';
import type { useRecipeScreen } from '#features/recipes/hooks/useRecipeScreen';
import { Text } from '#components/atoms/Text';

// ── Types ──

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

interface IngredientSelectorSheetProps {
  /** State-driven presentation — auto-presents/dismisses via the hook's
   *  guarded `visible` path (see useStandardBottomSheet). */
  visible: boolean;
  screen: ReturnType<typeof useRecipeScreen>;
  onSheetChange: (open: boolean) => void;
}

// ── Component ──

export const IngredientSelectorSheet: React.FC<
  IngredientSelectorSheetProps
> = ({ visible, screen, onSheetChange }) => {
  const { t } = useTranslation();
  const BottomSheetScrollable = useBottomSheetScrollableCreator();
  const ingredientSearchBarRef = useRef<BottomSheetSearchBarRef>(null);

  // Forward `onChange` through the hook so it composes with the backdrop
  // claim handler. Setting `onChange` directly on `<BottomSheetModal>`
  // below would overwrite the composition and silently break the dim
  // layer.
  const handleSheetChange = (index: number) => {
    onSheetChange(index >= 0);
    if (index >= 0) {
      screen.resetIngredientSearch();
      ingredientSearchBarRef.current?.clear();
    }
  };

  const { ref: sheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: () => {
      onSheetChange(false);
    },
    snapPoints: ['50%', '75%', '90%'],
    onChange: index => handleSheetChange(index),
  });

  const handleSearchAndClose = async () => {
    sheetRef.current?.close();
    await screen.handleIngredientSearch();
  };

  return (
    <BottomSheetModal ref={sheetRef} {...modalProps} index={0}>
      {/* Non-scrollable header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Title style={styles.title}>{t('recipes.selectIngredients')}</Title>
          <AppPressable
            style={[
              styles.searchButton,
              screen.selectedIngredients.size === 0 &&
                styles.searchButtonDisabled,
            ]}
            onPress={handleSearchAndClose}
            disabled={screen.selectedIngredients.size === 0}
          >
            <Text size="sm" weight="semibold" style={styles.searchButtonText}>
              {t('recipes.searchWithCount', {
                count: screen.selectedIngredients.size,
              })}
            </Text>
          </AppPressable>
        </View>

        {/* Search bar — shown when > 8 items */}
        {screen.pantryItems.length > 8 && (
          <BottomSheetSearchBar
            ref={ingredientSearchBarRef}
            placeholder={t('recipes.searchIngredientsPlaceholder')}
            onChangeText={screen.setIngredientSearchQuery}
            autoCapitalize="none"
          />
        )}

        {/* Selection counter */}
        {screen.selectedIngredients.size > 0 && (
          <View style={styles.selectionRow}>
            <Text size="sm" tone="secondary">
              {t('labels.selected', {
                count: screen.selectedIngredients.size,
              })}
            </Text>
            <Pressable onPress={screen.clearSelectedIngredients} hitSlop={8}>
              <Text size="sm" weight="medium" tone="accent">
                {t('labels.clearAll')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {/* Scrollable list — direct child of BottomSheetModal */}
      <IngredientSelectionProvider
        selectedIngredients={screen.selectedIngredients}
        toggleIngredient={screen.toggleIngredient}
      >
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={screen.filteredPantryItems}
          keyExtractor={ingredientKeyExtractor}
          getItemType={getItemType}
          renderItem={renderIngredientItem}
          extraData={screen.selectedIngredients.size}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={
            screen.pantryHasMore ? screen.loadMorePantryItems : undefined
          }
          onEndReachedThreshold={
            FLASHLIST_DEFAULTS.bottomSheet.onEndReachedThreshold
          }
          ListEmptyComponent={
            screen.ingredientSearchQuery ? (
              <Text
                size="md"
                tone="secondary"
                align="center"
                style={styles.emptyText}
              >
                {t('recipes.noIngredientsMatch', {
                  query: screen.ingredientSearchQuery,
                })}
              </Text>
            ) : (
              <Text
                size="md"
                tone="secondary"
                align="center"
                style={styles.emptyText}
              >
                {t('recipes.noPantryItemsAvailable')}
              </Text>
            )
          }
        />
      </IngredientSelectionProvider>
    </BottomSheetModal>
  );
};

// ── Styles ──

const styles = StyleSheet.create(theme => ({
  header: {
    paddingHorizontal: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  listContent: { paddingBottom: theme.spacing.xl },
  searchButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
  searchButtonDisabled: { opacity: theme.opacity.disabled },
  searchButtonText: {
    color: theme.colors.onPrimary,
  },
  emptyText: {
    marginTop: theme.spacing.xl,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
