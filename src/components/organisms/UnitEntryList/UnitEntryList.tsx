import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';

export interface UnitEntry {
  id: string;
  unitId?: string;
  unitName?: string;
  packageSize?: string;
  isDefault?: boolean;
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
  const { theme } = useUnistyles();

  const handleAddEntry = useCallback(() => {
    const isFirst = entries.length === 0;
    onEntriesChanged([...entries, createDefaultEntry(isFirst)]);
  }, [entries, onEntriesChanged]);

  const handleRemoveEntry = useCallback(
    (index: number) => {
      const updated = entries.filter((_, i) => i !== index);
      // If we removed the default entry, make the first one default
      if (updated.length > 0 && !updated.some(e => e.isDefault)) {
        updated[0] = { ...updated[0], isDefault: true };
      }
      onEntriesChanged(updated);
    },
    [entries, onEntriesChanged],
  );

  const handleEntryChange = useCallback(
    (index: number, field: keyof UnitEntry, value: any) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      );
      onEntriesChanged(updated);
    },
    [entries, onEntriesChanged],
  );

  const handleUnitSelected = useCallback(
    (index: number, unitId: string | null, unitName: string | null) => {
      const updated = entries.map((entry, i) =>
        i === index
          ? { ...entry, unitId: unitId ?? undefined, unitName: unitName ?? undefined }
          : entry,
      );
      onEntriesChanged(updated);
    },
    [entries, onEntriesChanged],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Units</Text>

      {entries.map((entry, index) => (
        <View key={entry.id} style={styles.entryRow}>
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
          <TouchableOpacity
            onPress={() => handleRemoveEntry(index)}
            disabled={disabled}
            style={styles.deleteButton}
          >
            <Icon name="delete" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      ))}

      <AnimatedButton
        variant="secondary"
        onPress={handleAddEntry}
        disabled={disabled}
      >
        Add Unit
      </AnimatedButton>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
}));
