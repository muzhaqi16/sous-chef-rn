import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import { SearchBar } from '#components/molecules/SearchBar';
import { useOpening } from '#hooks/ui/useOpening';
import { pantryItemSearch } from '#utils/searchUtils';
import { useDeferredSearch } from '#features/recipes/hooks/useDeferredSearch';
import { IngredientSelectionProvider } from '#features/recipes/context/IngredientSelectionContext';
import {
  renderIngredientItem,
  ingredientKeyExtractor,
} from '#features/recipes/components/recipeSearch/IngredientListItem';
import type { useRecipeScreen } from '#features/recipes/screens/useRecipeScreen';
import { Text } from '#components/atoms/Text';
import { hitSlop } from '#theme/foundations/sizes';

// ── Types ──

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

interface IngredientSelectorSheetProps {
  /** State-driven presentation — auto-presents/dismisses via the hook's
   *  guarded `visible` path (see useStandardBottomSheet). */
  visible: boolean;
  /** What the sheet reads of the recipe screen. */
  screen: Pick<
    ReturnType<typeof useRecipeScreen>,
    | 'pantryItems'
    | 'pantryHasMore'
    | 'loadMorePantryItems'
    | 'selectedIngredients'
    | 'toggleIngredient'
    | 'clearSelectedIngredients'
    | 'handleIngredientSearch'
  >;
  onSheetChange: (open: boolean) => void;
}

// ── Component ──

export const IngredientSelectorSheet: React.FC<
  IngredientSelectorSheetProps
> = ({ visible, screen, onSheetChange }) => {
  const { t } = useTranslation();
  const opening = useOpening(visible);

  const close = () => {
    onSheetChange(false);
  };

  const handleSearchAndClose = async () => {
    close();
    await screen.handleIngredientSearch();
  };

  return (
    <Sheet
      mode="list"
      visible={visible}
      onDismiss={close}
      title={t('recipes.selectIngredients')}
      actions={[
        {
          label: t('recipes.searchWithCount', {
            count: screen.selectedIngredients.size,
          }),
          variant: 'primary',
          disabled: screen.selectedIngredients.size === 0,
          onPress: () => {
            void handleSearchAndClose();
          },
        },
      ]}
      snapPoints={['50%', '75%', '90%']}
      // `onChange` goes through the sheet's options, which compose it with the
      // backdrop claim; set on the modal directly it would break the dim layer.
      onChange={index => onSheetChange(index >= 0)}
    >
      {opening ? <IngredientSelector key={opening.id} screen={screen} /> : null}
    </Sheet>
  );
};

/** One opening: its search starts empty, and a snap change keeps it. */
const IngredientSelector: React.FC<{
  screen: IngredientSelectorSheetProps['screen'];
}> = ({ screen }) => {
  const { t } = useTranslation();
  const BottomSheetScrollable = useBottomSheetScrollableCreator();
  const [query, setQuery] = useState('');
  const { results: shownPantryItems } = useDeferredSearch({
    items: screen.pantryItems,
    searchQuery: query,
    searchFn: pantryItemSearch,
  });

  return (
    <>
      {/* Non-scrollable header */}
      <View style={styles.header}>
        {/* Search bar — shown when > 8 items */}
        {screen.pantryItems.length > 8 && (
          <SearchBar
            placeholder={t('recipes.searchIngredientsPlaceholder')}
            onChangeText={setQuery}
            debounceMs={250}
            autoCapitalize="none"
            returnKeyType="search"
          />
        )}

        {/* Selection counter */}
        {screen.selectedIngredients.size > 0 && (
          <View style={styles.selectionRow}>
            <Text role="caption" tone="secondary">
              {t('labels.selected', {
                count: screen.selectedIngredients.size,
              })}
            </Text>
            <Pressable
              onPress={screen.clearSelectedIngredients}
              hitSlop={hitSlop.md}
            >
              <Text role="label" tone="accent">
                {t('labels.clearAll')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {/* The list fills what the header leaves. */}
      <IngredientSelectionProvider
        selectedIngredients={screen.selectedIngredients}
        toggleIngredient={screen.toggleIngredient}
      >
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={shownPantryItems}
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
            query ? (
              <Text
                role="body"
                tone="secondary"
                align="center"
                style={styles.emptyMessage}
              >
                {t('recipes.noIngredientsMatch', {
                  query,
                })}
              </Text>
            ) : (
              <Text
                role="body"
                tone="secondary"
                align="center"
                style={styles.emptyMessage}
              >
                {t('recipes.noPantryItemsAvailable')}
              </Text>
            )
          }
        />
      </IngredientSelectionProvider>
    </>
  );
};

// ── Styles ──

const styles = StyleSheet.create(theme => ({
  header: {
    paddingHorizontal: theme.spacing.md,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  listContent: { paddingBottom: theme.spacing.xl },
  emptyMessage: {
    marginTop: theme.spacing.xl,
  },
}));
