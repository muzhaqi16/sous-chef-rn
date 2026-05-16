import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
        {t('addToPantry.lowStockSettings')}
      </Text>
      <Text size="sm" tone="secondary" style={styles.sectionDescription}>
        {t('addToPantry.lowStockHint')}
      </Text>

      <FormInput
        label={t('addToPantry.alertWhenBelow')}
        value={minQuantity}
        onChangeText={setMinQuantity}
        placeholder={t('addToPantry.alertPlaceholder')}
        keyboardType="decimal-pad"
        useBottomSheetInput
      />

      <FormInput
        label={t('addToPantry.restockTo')}
        value={restockQuantity}
        onChangeText={setRestockQuantity}
        placeholder={t('addToPantry.restockPlaceholder')}
        keyboardType="decimal-pad"
        useBottomSheetInput
      />

      <Text size="sm" tone="secondary" style={styles.helpText}>
        {t('addToPantry.emptyHint')}
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
