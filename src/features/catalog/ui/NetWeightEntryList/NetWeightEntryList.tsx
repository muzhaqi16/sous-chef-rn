import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { EntryRowRemoveButton } from '#features/catalog/ui/EntryRowRemoveButton';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/atoms/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { Button } from '#components/molecules/Button';
import { localizeNumericHint } from '#/utils/formatters/number';
import { SectionHeader } from '#components/atoms/SectionHeader';

export interface NetWeightEntry {
  id: string;
  value?: string;
  unitId?: string;
  unitName?: string;
}

interface NetWeightEntryListProps {
  entries: NetWeightEntry[];
  onEntriesChanged: (entries: NetWeightEntry[]) => void;
  disabled?: boolean;
  /** Hides "Add Net Weight" once reached. Edit modes pass 1: PackageInfoInput
   *  carries a single netWeight, so extra entries could not be submitted. */
  maxEntries?: number;
}

let entryCounter = 0;
const generateEntryId = () => `nw-entry-${++entryCounter}-${Date.now()}`;

const createDefaultEntry = (): NetWeightEntry => ({
  id: generateEntryId(),
});

export const NetWeightEntryList: React.FC<NetWeightEntryListProps> = ({
  entries,
  onEntriesChanged,
  disabled = false,
  maxEntries,
}) => {
  const { t } = useTranslation();
  const canAddEntry = maxEntries == null || entries.length < maxEntries;

  const handleAddEntry = () => {
    onEntriesChanged([...entries, createDefaultEntry()]);
  };

  const handleRemoveEntry = (index: number) => {
    onEntriesChanged(entries.filter((_, i) => i !== index));
  };

  const handleValueChange = (index: number, text: string) => {
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, value: text } : entry,
    );
    onEntriesChanged(updated);
  };

  const handleUnitSelected = (
    index: number,
    unitId: string | null,
    unitName: string | null,
  ) => {
    // A null pair means "typing invalidated the previous selection", which
    // `handleUnitTextChange` already applied. Writing it here too would build a
    // second array from the same pre-write `entries` and clobber the typed name.
    if (unitId == null && unitName == null) return;
    const updated = entries.map((entry, i) =>
      i === index
        ? {
            ...entry,
            unitId: unitId ?? undefined,
            unitName: unitName ?? undefined,
          }
        : entry,
    );
    onEntriesChanged(updated);
  };

  const handleUnitTextChange = (index: number, text: string) => {
    // Sets the name and drops the selected unit id in ONE write.
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, unitName: text, unitId: undefined } : entry,
    );
    onEntriesChanged(updated);
  };

  return (
    <View>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('netWeightEntry.sectionTitle')}
      </SectionHeader>
      <DropdownStack>
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.valueField}>
              <FormInput
                label={t('netWeightEntry.weightLabel')}
                value={entry.value ?? ''}
                onChangeText={(text: string) => handleValueChange(index, text)}
                placeholder={localizeNumericHint(
                  t('netWeightEntry.weightPlaceholder'),
                )}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitField}>
              <UnitAutocompleteField
                variant="inline"
                label={t('labels.unit')}
                value={entry.unitName ?? ''}
                onChangeText={(text: string) =>
                  handleUnitTextChange(index, text)
                }
                placeholder={t('netWeightEntry.unitPlaceholder')}
                onUnitSelected={(unitId, unitName) =>
                  handleUnitSelected(index, unitId, unitName)
                }
              />
            </View>
            <EntryRowRemoveButton
              onPress={() => handleRemoveEntry(index)}
              disabled={disabled}
            />
          </View>
        ))}
        {!!canAddEntry && (
          <Button
            variant="secondary"
            onPress={handleAddEntry}
            disabled={disabled}
            style={styles.addButton}
          >
            {t('netWeightEntry.addButton')}
          </Button>
        )}
      </DropdownStack>
    </View>
  );
};

// A row's fields space themselves below; the list adds space only under its
// "Add" button, which edit modes hide.
const styles = StyleSheet.create(theme => ({
  addButton: {
    marginBottom: theme.spacing.md,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.borderLight,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  valueField: {
    flex: 0.35,
  },
  unitField: {
    flex: 0.55,
  },
}));
