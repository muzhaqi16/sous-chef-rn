import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SEVERITY_LABEL_KEYS } from '#domain/dietary';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { SearchBar } from '#components/molecules/SearchBar';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Sheet } from '#components/templates/Sheet';
import { profileTestIDs } from '#features/profile/testIDs';
import { commonStyles } from '#/styles/commonStyles';
import { AvoidFoodRow } from './AvoidFoodRow';
import { useAvoidFoodSearch } from './useAvoidFoodSearch';

/** Mildest first: avoiding a food is the common case, so it leads. */
const SEVERITIES: RestrictionSeverity[] = [
  RestrictionSeverity.Preference,
  RestrictionSeverity.Intolerance,
  RestrictionSeverity.Allergy,
];

/** The API allows 30 food searches a minute, so the field waits for typing to pause. */
const SEARCH_QUIET_MS = 500;

interface AvoidFoodSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Resolves whether the food was added; the sheet closes only when it was. */
  onPick: (itemId: string, severity: RestrictionSeverity) => Promise<boolean>;
}

/**
 * Picks a catalog food to avoid. The server stores the pick as its root, so
 * avoiding bacon avoids every kind of bacon.
 */
export const AvoidFoodSheet: React.FC<AvoidFoodSheetProps> = ({
  visible,
  onDismiss,
  onPick,
}) => {
  const { t } = useTranslation();
  const search = useAvoidFoodSearch();
  const { reset } = search;
  const [severity, setSeverity] = useState(RestrictionSeverity.Preference);
  const [saving, setSaving] = useState(false);

  // Adjusting state during render: a fresh open starts at the mildest.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSeverity(RestrictionSeverity.Preference);
  }

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const handlePick = async (itemId: string) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(itemId, severity);
    setSaving(false);
    if (added) onDismiss();
  };

  const notice = search.offline
    ? t('dietaryProfile.avoidSearchNeedsConnection')
    : search.failure ??
      (search.noMatches
        ? t('empty.noResultsFor', { query: search.searchTerm })
        : null);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['85%']}
      title={t('dietaryProfile.avoidSheetTitle')}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <View testID={profileTestIDs.avoidSheet}>
        <Text role="body" tone="secondary" style={styles.spaced}>
          {t('dietaryProfile.avoidHint')}
        </Text>
        <View style={styles.spaced}>
          <SegmentedControl
            options={SEVERITIES}
            value={severity}
            onChange={setSeverity}
            formatLabel={option => {
              const key = SEVERITY_LABEL_KEYS[option];
              return key ? t(key) : t('labels.unknown');
            }}
            testID={profileTestIDs.avoidSeverity}
          />
        </View>
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
          <AvoidFoodRow
            key={food.id}
            food={food}
            onPress={() => {
              void handlePick(food.id);
            }}
          />
        ))}
        {notice !== null && (
          <Text role="body" tone="secondary" align="center">
            {notice}
          </Text>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  spaced: {
    marginBottom: theme.spacing.md,
  },
}));
