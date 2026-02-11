import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';

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
}) => {
  const { theme } = useUnistyles();

  const handleAddEntry = useCallback(() => {
    onEntriesChanged([...entries, createDefaultEntry()]);
  }, [entries, onEntriesChanged]);

  const handleRemoveEntry = useCallback(
    (index: number) => {
      onEntriesChanged(entries.filter((_, i) => i !== index));
    },
    [entries, onEntriesChanged],
  );

  const handleValueChange = useCallback(
    (index: number, text: string) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, value: text } : entry,
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

  const handleUnitTextChange = useCallback(
    (index: number, text: string) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, unitName: text } : entry,
      );
      onEntriesChanged(updated);
    },
    [entries, onEntriesChanged],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Net Weights</Text>

      {entries.map((entry, index) => (
        <View key={entry.id} style={styles.entryRow}>
          <View style={styles.valueField}>
            <FormInput
              label="Weight"
              value={entry.value || ''}
              onChangeText={(text: string) => handleValueChange(index, text)}
              placeholder="e.g., 3.4"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.unitField}>
            <UnitAutocompleteField
              variant="modal"
              label="Unit"
              value={entry.unitName || ''}
              onChangeText={(text: string) => handleUnitTextChange(index, text)}
              placeholder="e.g., oz, g"
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
        Add Net Weight
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
}));
