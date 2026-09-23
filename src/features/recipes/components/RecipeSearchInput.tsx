import { useState, useImperativeHandle, forwardRef } from 'react';
import { useUnistyles } from 'react-native-unistyles';
import {
  SearchBar,
  type SearchBarAction,
} from '#components/molecules/SearchBar';
import { useTranslation } from '#/i18n';
import { recipesTestIDs } from '#features/recipes/testIDs';

export interface RecipeSearchInputRef {
  clear: () => void;
}

interface RecipeSearchInputProps {
  onSearch: (query: string) => void;
  extraActions: SearchBarAction[];
  /** Seeds the field so the submitted query survives the screen's
   * skeleton↔list remounts (this component is rendered in two tree positions).
   * Read once on mount — keystrokes stay local to keep the parent from
   * re-rendering on every character. */
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
  // `useUnistyles()` is intentional: theme colors are constructed into the
  // dynamic `SearchBarAction[]` prop array passed to `<SearchBar>`. The action
  // shape carries `color`/`backgroundColor` strings, so a `withUnistyles`
  // wrap on SearchBar would require redesigning the SearchBarAction type.
  const { theme } = useUnistyles();

  useImperativeHandle(ref, () => ({
    clear: () => setInputQuery(''),
  }));

  const rightActions: SearchBarAction[] = [
    ...extraActions,
    {
      icon: 'search',
      onPress: () => onSearch(inputQuery),
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
      placeholder={t('recipes.searchPlaceholder')}
      rightActions={rightActions}
      testID={recipesTestIDs.searchInput}
    />
  );
});
