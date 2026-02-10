import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from '#/components/molecules/FormInput';
import { FormCheckbox } from '#/components/molecules/FormCheckbox';
import { UnitAutocompleteField } from '#/components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#/components/molecules/FieldRow';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';

export interface UnitEntry {
  id: string;
  unitId?: string;
  unitName?: string;
  packageSize?: string;
  contentUnitId?: string;
  contentUnitName?: string;
  retailUnit?: boolean;
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

  const handleContentUnitSelected = useCallback(
    (index: number, unitId: string | null, unitName: string | null) => {
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
    },
    [entries, onEntriesChanged],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Units</Text>

      {entries.map((entry, index) => (
        <View key={entry.id} style={styles.entryCard}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryLabel}>
              Unit {index + 1}
              {entry.isDefault ? ' (Default)' : ''}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveEntry(index)}
              disabled={disabled}
              style={styles.removeButton}
            >
              <Icon name="delete" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          </View>

          <FieldRow>
            <UnitAutocompleteField
              variant="modal"
              label="Unit"
              value={entry.unitName || ''}
              onChangeText={(text: string) =>
                handleEntryChange(index, 'unitName', text)
              }
              placeholder="e.g., kg, lbs"
              onUnitSelected={(unitId, unitName) =>
                handleUnitSelected(index, unitId, unitName)
              }
            />
            <FormInput
              label="Package Size"
              value={entry.packageSize || ''}
              onChangeText={(text: string) =>
                handleEntryChange(index, 'packageSize', text)
              }
              placeholder="e.g., 12"
              keyboardType="decimal-pad"
            />
          </FieldRow>

          <UnitAutocompleteField
            variant="modal"
            label="Content Unit"
            value={entry.contentUnitName || ''}
            onChangeText={(text: string) =>
              handleEntryChange(index, 'contentUnitName', text)
            }
            placeholder="e.g., can, bottle"
            onUnitSelected={(unitId, unitName) =>
              handleContentUnitSelected(index, unitId, unitName)
            }
          />

          <FormCheckbox
            label="Retail Unit"
            checked={entry.retailUnit || false}
            onPress={() =>
              handleEntryChange(index, 'retailUnit', !entry.retailUnit)
            }
            disabled={disabled}
          />
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
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  entryLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
}));
