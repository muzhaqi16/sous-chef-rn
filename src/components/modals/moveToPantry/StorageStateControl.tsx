import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { StorageState } from '#/graphql/generated/schemaTypes';

const STORAGE_STATES = Object.values(StorageState);

interface StorageStateControlProps {
  value: StorageState;
  onChange: (state: StorageState) => void;
}

/**
 * Segmented control for picking a {@link StorageState} in
 * {@link MoveToPantryModal}.
 */
export const StorageStateControl: React.FC<StorageStateControlProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();

  const storageStateLabel: Record<StorageState, string> = {
    [StorageState.Ambient]: t('moveToPantry.stateAmbient'),
    [StorageState.Refrigerated]: t('moveToPantry.stateRefrigerated'),
    [StorageState.Frozen]: t('moveToPantry.stateFrozen'),
    [StorageState.None]: '',
  };

  return (
    <View style={styles.section}>
      <Text size="md" weight="medium" style={styles.sectionLabel}>
        {t('moveToPantry.storageType')}
      </Text>
      <View style={styles.segmentedControl}>
        {STORAGE_STATES.map(state => (
          <Pressable
            key={state}
            style={({ pressed }) => [
              styles.segment,
              value === state && styles.segmentActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange(state)}
          >
            <Text
              style={[
                styles.segmentText,
                value === state && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {storageStateLabel[state]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
