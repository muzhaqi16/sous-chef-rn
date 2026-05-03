import React from 'react';

import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { Text } from '#components/atoms/Text';

export interface StockSettingsPageProps {
  minQuantity: string;
  setMinQuantity: (value: string) => void;
  restockQuantity: string;
  setRestockQuantity: (value: string) => void;
  insets: { bottom: number };
}

export const StockSettingsPage: React.FC<StockSettingsPageProps> = ({
  minQuantity,
  setMinQuantity,
  restockQuantity,
  setRestockQuantity,
  insets,
}) => {
  return (
    <BottomSheetKeyboardAwareScrollView
      key="stock"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Low Stock Settings
      </Text>
      <Text size="sm" tone="secondary" style={styles.sectionDescription}>
        Get notified when this item is running low.
      </Text>

      <FormInput
        label="Alert When Below"
        value={minQuantity}
        onChangeText={setMinQuantity}
        placeholder="e.g., 2"
        keyboardType="decimal-pad"
        useBottomSheetInput
      />

      <FormInput
        label="Restock To"
        value={restockQuantity}
        onChangeText={setRestockQuantity}
        placeholder="e.g., 6"
        keyboardType="decimal-pad"
        useBottomSheetInput
      />

      <Text size="sm" tone="secondary" style={styles.helpText}>
        Leave empty to disable low stock alerts for this item.
      </Text>
    </BottomSheetKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  page: {
    flex: 1,
    minHeight: '100%',
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  sectionTitle: {
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    marginBottom: theme.spacing.md,
  },
  helpText: {
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
}));
