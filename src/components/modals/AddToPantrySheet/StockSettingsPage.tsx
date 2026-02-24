import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';

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
      <Text style={styles.sectionTitle}>Low Stock Settings</Text>
      <Text style={styles.sectionDescription}>
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

      <Text style={styles.helpText}>
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  helpText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
}));
