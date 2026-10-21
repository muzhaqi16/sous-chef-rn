import { useState, useImperativeHandle, forwardRef } from 'react';
import { useUnistyles } from 'react-native-unistyles';
import {
  SearchBar,
  type SearchBarAction,
} from '#components/molecules/SearchBar';
import { useTranslation } from '#/i18n';
import { MAX_RECIPE_QUERY_LENGTH } from '#domain/catalogRecipes';
import { recipesTestIDs } from '#features/recipes/testIDs';

export interface RecipeSearchInputRef {
  clear: () => void;
}

interface RecipeSearchInputProps {
  onSearch: (query: string) => void;
  extraActions: SearchBarAction[];
  /** Seeds the field so the submitted query survives the screen's
   * skeleton↔list remounts. Read once on mount: keystrokes stay local so the
   * parent does not re-render per character. */
  initialQuery: string;
  /** Tapped the ✕ — clear the field and cancel the active search. */
  onClear: () => void;
}

/** The recipe search field; keystrokes re-render only this component. */
export const RecipeSearchInput = forwardRef<
  RecipeSearchInputRef,
  RecipeSearchInputProps
>(({ onSearch, extraActions, initialQuery, onClear }, ref) => {
  const { t } = useTranslation();
  const [inputQuery, setInputQuery] = useState(initialQuery);
  // `useUnistyles()` because theme colours go into the `SearchBarAction[]` prop
  // as `color`/`backgroundColor` strings, which a `withUnistyles` wrap cannot
  // theme.
  const { theme } = useUnistyles();

  useImperativeHandle(ref, () => ({
    clear: () => setInputQuery(''),
  }));

  const rightActions: SearchBarAction[] = [
    ...extraActions,
    {
      icon: 'search',
      onPress: () => onSearch(inputQuery),
      accessibilityLabel: t('labels.search'),
      color: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      testID: recipesTestIDs.searchSubmit,
    },
  ];

  return (
    <SearchBar
      value={inputQuery}
      onChangeText={setInputQuery}
      onClear={onClear}
      onSubmitEditing={() => onSearch(inputQuery)}
      returnKeyType="search"
      maxLength={MAX_RECIPE_QUERY_LENGTH}
      placeholder={t('recipes.searchPlaceholder')}
      rightActions={rightActions}
      testID={recipesTestIDs.searchInput}
    />
  );
});
