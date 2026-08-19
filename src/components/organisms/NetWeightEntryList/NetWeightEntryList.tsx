import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import { Button } from '#/components/base/Button';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';

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
    // Sets the name and drops any previously selected unit id in ONE write.
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, unitName: text, unitId: undefined } : entry,
    );
    onEntriesChanged(updated);
  };

  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('netWeightEntry.sectionTitle')}
      </Text>
      <DropdownStack>
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.valueField}>
              <FormInput
                label={t('netWeightEntry.weightLabel')}
                value={entry.value || ''}
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
                label={t('netWeightEntry.unitLabel')}
                value={entry.unitName || ''}
                onChangeText={(text: string) =>
                  handleUnitTextChange(index, text)
                }
                placeholder={t('netWeightEntry.unitPlaceholder')}
                onUnitSelected={(unitId, unitName) =>
                  handleUnitSelected(index, unitId, unitName)
                }
              />
            </View>
            <AppPressable
              onPress={() => handleRemoveEntry(index)}
              disabled={disabled}
              style={styles.deleteButton}
            >
              <Icon name="trash-outline" size={20} tone="error" />
            </AppPressable>
          </View>
        ))}
        {!!canAddEntry && (
          <Button
            variant="secondary"
            onPress={handleAddEntry}
            disabled={disabled}
          >
            {t('netWeightEntry.addButton')}
          </Button>
        )}
      </DropdownStack>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  valueField: {
    flex: 0.35,
  },
  unitField: {
    flex: 0.55,
  },
  deleteButton: {
    flex: 0.1,
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
