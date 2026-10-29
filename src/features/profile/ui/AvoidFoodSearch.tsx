import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { SearchBar } from '#components/molecules/SearchBar';
import { profileTestIDs } from '#features/profile/testIDs';
import { AvoidFoodRow } from './AvoidFoodRow';
import { useAvoidFoodSearch } from './useAvoidFoodSearch';

/** The API allows 30 food searches a minute, so the field waits for typing to pause. */
const SEARCH_QUIET_MS = 500;

interface AvoidFoodSearchProps {
  onPick: (food: { id: string; name: string }) => void;
  /** Resets the search when it becomes false, as a closing sheet does. */
  active?: boolean;
}

/**
 * A search for catalog foods (never products) to avoid, with its results and
 * the reason when it can't answer. The avoid sheet and onboarding share it.
 */
export const AvoidFoodSearch: React.FC<AvoidFoodSearchProps> = ({
  onPick,
  active = true,
}) => {
  const { t } = useTranslation();
  const search = useAvoidFoodSearch();
  const { reset } = search;

  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  const notice = search.offline
    ? t('dietaryProfile.avoidSearchNeedsConnection')
    : search.failure ??
      (search.noMatches
        ? t('empty.noResultsFor', { query: search.searchTerm })
        : null);

  return (
    <>
      <SearchBar
        testID={profileTestIDs.avoidSearchInput}
        placeholder={t('dietaryProfile.avoidSearchPlaceholder')}
        onChangeText={search.onSearchTermChange}
        debounceMs={SEARCH_QUIET_MS}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        isLoading={search.searching}
        containerStyle={styles.spaced}
      />
      {search.foods.map(food => (
        <AvoidFoodRow key={food.id} food={food} onPress={onPick} />
      ))}
      {notice !== null && (
        <Text role="body" tone="secondary" align="center">
          {notice}
        </Text>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  spaced: {
    marginBottom: theme.spacing.md,
  },
}));
