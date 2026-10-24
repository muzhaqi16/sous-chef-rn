import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import {
  RestrictionSeverity,
  type ItemSuggestion,
} from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ListItem } from '#components/molecules/ListItem';
import { SearchBar } from '#components/molecules/SearchBar';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Sheet } from '#components/templates/Sheet';
import { useItemAutocomplete } from '#features/catalog/hooks/useItemAutocomplete';
import { profileTestIDs } from '#features/profile/testIDs';
import { resolveImageUrl } from '#utils/imageUtils';
import { commonStyles } from '#/styles/commonStyles';

/** Mildest first: avoiding a food is the common case, so it leads. */
const SEVERITIES: RestrictionSeverity[] = [
  RestrictionSeverity.Preference,
  RestrictionSeverity.Intolerance,
  RestrictionSeverity.Allergy,
];

const SEVERITY_LABEL_KEYS: Partial<
  Record<RestrictionSeverity, TranslationKey>
> = {
  [RestrictionSeverity.Preference]: 'dietaryProfile.avoidSeverity.preference',
  [RestrictionSeverity.Intolerance]: 'dietaryProfile.avoidSeverity.intolerance',
  [RestrictionSeverity.Allergy]: 'dietaryProfile.avoidSeverity.allergy',
};

interface AvoidFoodSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Resolves whether the food was added; the sheet closes only when it was. */
  onPick: (itemId: string, severity: RestrictionSeverity) => Promise<boolean>;
}

/**
 * Picks a catalog food to avoid. The server stores the pick as its root, so
 * one brand's bacon avoids every bacon.
 */
export const AvoidFoodSheet: React.FC<AvoidFoodSheetProps> = ({
  visible,
  onDismiss,
  onPick,
}) => {
  const { t } = useTranslation();
  const autocomplete = useItemAutocomplete({ debounceMs: 0 });
  const { reset } = autocomplete;
  const [severity, setSeverity] = useState(RestrictionSeverity.Preference);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const searched =
    autocomplete.searchTerm.length >= 2 && !autocomplete.isLoading;

  const handlePick = async (picked: ItemSuggestion) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(picked.id, severity);
    setSaving(false);
    if (added) onDismiss();
  };

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
          onChangeText={autocomplete.handleSearchTermChange}
          debounceMs={250}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          isLoading={!!autocomplete.isLoading}
          containerStyle={styles.spaced}
        />
        {autocomplete.displayItems.map(item => (
          <RowCard
            key={item.id}
            testID={profileTestIDs.avoidCandidate(item.id)}
          >
            <ListItem
              title={item.name}
              subtitle={item.category?.name ?? undefined}
              leftElement={<RowThumbnail uri={resolveImageUrl(item)} />}
              onPress={() => {
                void handlePick(item);
              }}
              accessibilityLabel={t('dietaryProfile.avoidNamed', {
                name: item.name,
              })}
            />
          </RowCard>
        ))}
        {!!searched && autocomplete.displayItems.length === 0 && (
          <Text role="body" tone="secondary" align="center">
            {t('empty.noResultsFor', { query: autocomplete.searchTerm })}
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
