import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { IngredientSelectorProvider } from './IngredientSelectorContext';
import {
  renderIngredientItem,
  ingredientKeyExtractor,
} from './IngredientListItem';
import type { useRecipeScreen } from '#features/recipes/hooks/useRecipeScreen';
import { Text } from '#components/atoms/Text';

// ── Types ──

export interface IngredientSelectorSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface IngredientSelectorSheetProps {
  screen: ReturnType<typeof useRecipeScreen>;
  onSheetChange: (open: boolean) => void;
}

// ── Component ──

export const IngredientSelectorSheet = forwardRef<
  IngredientSelectorSheetRef,
  IngredientSelectorSheetProps
>(({ screen, onSheetChange }, ref) => {
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
    onDismiss: () => {
      onSheetChange(false);
    },
    snapPoints: ['50%', '75%', '90%'],
    keyboardAware: true,
    onChange: index => handleSheetChange(index),
  });

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

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
              {t('recipes.selectedCount', {
                count: screen.selectedIngredients.size,
              })}
            </Text>
            <Pressable onPress={screen.clearSelectedIngredients} hitSlop={8}>
              <Text size="sm" weight="medium" tone="accent">
                {t('recipes.clearAll')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {/* Scrollable list — direct child of BottomSheetModal */}
      <IngredientSelectorProvider
        selectedIngredients={screen.selectedIngredients}
        toggleIngredient={screen.toggleIngredient}
      >
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={screen.filteredPantryItems}
          keyExtractor={ingredientKeyExtractor}
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
      </IngredientSelectorProvider>
    </BottomSheetModal>
  );
});

IngredientSelectorSheet.displayName = 'IngredientSelectorSheet';

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
    color: theme.colors.white,
  },
  emptyText: {
    marginTop: theme.spacing.xl,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
