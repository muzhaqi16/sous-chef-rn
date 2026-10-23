import { useState, useImperativeHandle, forwardRef } from 'react';
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
  /** The one control beside the field: the diet filter. */
  accessory?: SearchBarAction;
  /** Seeds the field so the submitted query survives the screen's
   * skeleton↔list remounts. Read once on mount: keystrokes stay local so the
   * parent does not re-render per character. */
  initialQuery: string;
  /** Tapped the ✕ — clear the field and cancel the active search. */
  onClear: () => void;
}

/**
 * The recipe name search; keystrokes re-render only this component. The
 * keyboard's Search key runs it, so no button beside the field repeats that.
 */
export const RecipeSearchInput = forwardRef<
  RecipeSearchInputRef,
  RecipeSearchInputProps
>(({ onSearch, accessory, initialQuery, onClear }, ref) => {
  const { t } = useTranslation();
  const [inputQuery, setInputQuery] = useState(initialQuery);

  useImperativeHandle(ref, () => ({
    clear: () => setInputQuery(''),
  }));

  return (
    <SearchBar
      value={inputQuery}
      onChangeText={setInputQuery}
      onClear={onClear}
      onSubmitEditing={() => onSearch(inputQuery)}
      returnKeyType="search"
      maxLength={MAX_RECIPE_QUERY_LENGTH}
      placeholder={t('recipes.searchPlaceholder')}
      accessory={accessory}
      testID={recipesTestIDs.searchInput}
    />
  );
});
