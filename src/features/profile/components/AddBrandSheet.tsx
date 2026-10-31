import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { ListItem } from '#components/molecules/ListItem';
import { SearchBar } from '#components/molecules/SearchBar';
import { Sheet } from '#components/templates/Sheet';
import { useBrandAutocomplete } from '#features/catalog/hooks/useBrandAutocomplete';
import { profileTestIDs } from '#features/profile/testIDs';
import { commonStyles } from '#/styles/commonStyles';

interface AddBrandSheetProps {
  visible: boolean;
  listName: string;
  /** Brands the list already holds, left out of the results. */
  heldBrandIds: ReadonlySet<string>;
  onDismiss: () => void;
  /** Resolves whether the brand was added; the sheet closes only when it was. */
  onPick: (
    brand: { id: string; name: string },
    reason: string | null,
  ) => Promise<boolean>;
}

/** Picks a catalog brand for a list, with an optional note on why. */
export const AddBrandSheet: React.FC<AddBrandSheetProps> = ({
  visible,
  listName,
  heldBrandIds,
  onDismiss,
  onPick,
}) => {
  const { t } = useTranslation();
  const autocomplete = useBrandAutocomplete();
  const { reset } = autocomplete;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // A closed sheet forgets its note, adjusted while rendering.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setNote('');
  }

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  // Brands show once the user searches: unprompted, the catalog's first page
  // is just its alphabetical start.
  const searching = autocomplete.searchTerm.length >= 2;
  const results = searching
    ? autocomplete.displayItems.filter(brand => !heldBrandIds.has(brand.id))
    : [];
  const searched = searching && !autocomplete.isLoading;

  const handlePick = async (brand: { id: string; name: string }) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(brand, note.trim() || null);
    setSaving(false);
    if (added) onDismiss();
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['85%']}
      title={t('brandLists.addBrandTitle', { name: listName })}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <View testID={profileTestIDs.addBrandSheet}>
        <BaseInput
          label={t('brandLists.noteLabel')}
          defaultValue={note}
          onChangeText={setNote}
          placeholder={t('brandLists.notePlaceholder')}
          maxLength={500}
          testID={profileTestIDs.addBrandNoteInput}
        />
        <SearchBar
          testID={profileTestIDs.addBrandSearchInput}
          placeholder={t('brandLists.searchBrands')}
          onChangeText={autocomplete.handleSearchTermChange}
          debounceMs={250}
          autoCapitalize="words"
          returnKeyType="search"
          isLoading={!!autocomplete.isLoading}
          containerStyle={styles.spaced}
        />
        {results.map(brand => (
          <RowCard
            key={brand.id}
            testID={profileTestIDs.addBrandCandidate(brand.id)}
          >
            <ListItem
              title={brand.name}
              onPress={() => {
                void handlePick(brand);
              }}
              accessibilityLabel={t('labels.addNamed', {
                name: brand.name,
              })}
            />
          </RowCard>
        ))}
        {!!searched && results.length === 0 && (
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
