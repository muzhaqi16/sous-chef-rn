import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import { Button } from '#/components/base/Button';
import { Text } from '#components/atoms/Text';

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

  const handleEntryChange = (
    index: number,
    field: keyof UnitEntry,
    value: any,
  ) => {
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onEntriesChanged(updated);
  };

  const handleUnitSelected = (
    index: number,
    unitId: string | null,
    unitName: string | null,
  ) => {
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
        Units
      </Text>

      {entries.map((entry, index) => (
        <View key={entry.id}>
          <View style={styles.entryRow}>
            <View style={styles.packageSizeField}>
              <FormInput
                label="Size"
                value={entry.packageSize || ''}
                onChangeText={(text: string) =>
                  handleEntryChange(index, 'packageSize', text)
                }
                placeholder="e.g., 12"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitField}>
              <UnitAutocompleteField
                variant="modal"
                label={index === 0 ? 'Unit (Default)' : 'Unit'}
                value={entry.unitName || ''}
                onChangeText={(text: string) =>
                  handleEntryChange(index, 'unitName', text)
                }
                placeholder="e.g., kg, lbs"
                onUnitSelected={(unitId, unitName) =>
                  handleUnitSelected(index, unitId, unitName)
                }
              />
            </View>
            <Pressable
              onPress={() => handleRemoveEntry(index)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="trash-outline" size={20} tone="error" />
            </Pressable>
          </View>
          {!!entry.packageSize && parseFloat(entry.packageSize) > 0 && (
            <View style={styles.contentUnitRow}>
              <UnitAutocompleteField
                variant="modal"
                label="Contains"
                value={entry.contentUnitName || ''}
                onChangeText={(text: string) =>
                  handleEntryChange(index, 'contentUnitName', text)
                }
                placeholder="e.g., can, bottle"
                onUnitSelected={(unitId, unitName) =>
                  handleContentUnitSelected(index, unitId, unitName)
                }
              />
            </View>
          )}
        </View>
      ))}

      <Button variant="secondary" onPress={handleAddEntry} disabled={disabled}>
        Add Unit
      </Button>
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
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.borderLight,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
