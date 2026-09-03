import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { Button } from '#components/atoms/Button';
import { Text } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface UnitEntry {
  id: string;
  unitId?: string;
  unitName?: string;
  packageSize?: string;
  isDefault?: boolean;
  contentUnitId?: string;
  contentUnitName?: string;
}

interface UnitEntryListProps {
  entries: UnitEntry[];
  onEntriesChanged: (entries: UnitEntry[]) => void;
  disabled?: boolean;
}

let entryCounter = 0;
const generateEntryId = () => `unit-entry-${++entryCounter}-${Date.now()}`;

const createDefaultEntry = (isDefault: boolean): UnitEntry => ({
  id: generateEntryId(),
  isDefault,
});

export const UnitEntryList: React.FC<UnitEntryListProps> = ({
  entries,
  onEntriesChanged,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const handleAddEntry = () => {
    const isFirst = entries.length === 0;
    onEntriesChanged([...entries, createDefaultEntry(isFirst)]);
  };

  const handleRemoveEntry = (index: number) => {
    const updated = entries.filter((_, i) => i !== index);
    // If we removed the default entry, make the first one default
    if (updated.length > 0 && !updated.some(e => e.isDefault)) {
      updated[0] = { ...updated[0], isDefault: true };
    }
    onEntriesChanged(updated);
  };

  const handleEntryChange = <K extends keyof UnitEntry>(
    index: number,
    field: K,
    value: UnitEntry[K],
  ) => {
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onEntriesChanged(updated);
  };

  /** Sets the typed name and drops any selected id in ONE write. Splitting the
   *  two across the text and selection callbacks would build two arrays from
   *  the same pre-write `entries` in one tick, and the second would clobber
   *  the typed name. */
  const handleUnitTextChange = (
    index: number,
    field: 'unitName' | 'contentUnitName',
    text: string,
  ) => {
    const idField = field === 'unitName' ? 'unitId' : 'contentUnitId';
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, [field]: text, [idField]: undefined } : entry,
    );
    onEntriesChanged(updated);
  };

  const handleUnitSelected = (
    index: number,
    unitId: string | null,
    unitName: string | null,
  ) => {
    // A null pair means "typing invalidated the previous selection", already
    // applied by `handleUnitTextChange` — see the note there.
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

  const handleContentUnitSelected = (
    index: number,
    unitId: string | null,
    unitName: string | null,
  ) => {
    if (unitId == null && unitName == null) return;
    const updated = entries.map((entry, i) =>
      i === index
        ? {
            ...entry,
            contentUnitId: unitId ?? undefined,
            contentUnitName: unitName ?? undefined,
          }
        : entry,
    );
    onEntriesChanged(updated);
  };

  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('unitEntryList.title')}
      </Text>
      <DropdownStack>
        {entries.map((entry, index) => (
          <View key={entry.id}>
            <DropdownStack>
              <View style={styles.entryRow}>
                <View style={styles.packageSizeField}>
                  <FormInput
                    label={t('unitEntryList.size')}
                    value={entry.packageSize || ''}
                    onChangeText={(text: string) =>
                      handleEntryChange(index, 'packageSize', text)
                    }
                    placeholder={t('labels.eG12')}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.unitField}>
                  <UnitAutocompleteField
                    variant="inline"
                    label={
                      index === 0
                        ? t('unitEntryList.unitDefaultLabel')
                        : t('storageLocationForm.unit')
                    }
                    value={entry.unitName || ''}
                    onChangeText={(text: string) =>
                      handleUnitTextChange(index, 'unitName', text)
                    }
                    placeholder={t('unitEntryList.unitPlaceholder')}
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
              {!!entry.packageSize &&
                parseDecimalInput(entry.packageSize) > 0 && (
                  <View style={styles.contentUnitRow}>
                    <UnitAutocompleteField
                      variant="inline"
                      label={t('unitEntryList.contains')}
                      value={entry.contentUnitName || ''}
                      onChangeText={(text: string) =>
                        handleUnitTextChange(index, 'contentUnitName', text)
                      }
                      placeholder={t('labels.eGCanBottle')}
                      onUnitSelected={(unitId, unitName) =>
                        handleContentUnitSelected(index, unitId, unitName)
                      }
                    />
                  </View>
                )}
            </DropdownStack>
          </View>
        ))}
        <Button
          variant="secondary"
          onPress={handleAddEntry}
          disabled={disabled}
        >
          {t('unitEntryList.addUnit')}
        </Button>
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.borderLight,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  packageSizeField: {
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
  contentUnitRow: {
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderLeftWidth: theme.borderWidth.medium,
    borderLeftColor: theme.colors.borderLight,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
