import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { StoreAutocompleteField } from '#components/molecules/AutocompleteField/StoreAutocompleteField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Text } from '#components/atoms/Text';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';

// The methods a user picks when manually adding (BARCODE_SCAN / SHOPPING_LIST
// are set automatically by those flows, not chosen here).
const ACQUISITION_METHODS = [
  AcquisitionMethod.Purchased,
  AcquisitionMethod.Homegrown,
  AcquisitionMethod.Gifted,
  AcquisitionMethod.Other,
];

export interface StockSettingsPageProps {
  minQuantity: string;
  setMinQuantity: (value: string) => void;
  restockQuantity: string;
  setRestockQuantity: (value: string) => void;
  storeName: string;
  setStoreName: (value: string) => void;
  handleStoreSelected: (
    storeId: string | null,
    storeName: string | null,
  ) => void;
  costPerUnit: string;
  setCostPerUnit: (value: string) => void;
  acquisitionMethod: AcquisitionMethod;
  setAcquisitionMethod: (value: AcquisitionMethod) => void;
  insets: { bottom: number };
}

export const StockSettingsPage: React.FC<StockSettingsPageProps> = ({
  minQuantity,
  setMinQuantity,
  restockQuantity,
  setRestockQuantity,
  storeName,
  setStoreName,
  handleStoreSelected,
  costPerUnit,
  setCostPerUnit,
  acquisitionMethod,
  setAcquisitionMethod,
  insets,
}) => {
  const { t } = useTranslation();
  const formatMethodLabel = (value: AcquisitionMethod) => {
    switch (value) {
      case AcquisitionMethod.Purchased:
        return t('addToPantry.methodPurchased');
      case AcquisitionMethod.Homegrown:
        return t('addToPantry.methodHomegrown');
      case AcquisitionMethod.Gifted:
        return t('addToPantry.methodGifted');
      case AcquisitionMethod.Other:
        return t('addToPantry.methodOther');
      default:
        return value;
    }
  };
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

      {/* Purchase Info */}
      <Text size="lg" weight="semibold" style={styles.purchaseTitle}>
        {t('addToPantry.purchaseInfo')}
      </Text>

      <View style={[styles.section, { zIndex: 10 }]}>
        <StoreAutocompleteField
          variant="inline"
          label={t('addToPantry.store')}
          value={storeName}
          onChangeText={setStoreName}
          placeholder={t('addToPantry.storePlaceholder')}
          onStoreSelected={handleStoreSelected}
        />
      </View>

      <FormInput
        label={t('addToPantry.cost')}
        value={costPerUnit}
        onChangeText={setCostPerUnit}
        placeholder={t('addToPantry.costPlaceholder')}
        keyboardType="decimal-pad"
        useBottomSheetInput
      />

      <SegmentedControl
        label={t('addToPantry.acquisitionMethod')}
        options={ACQUISITION_METHODS}
        value={acquisitionMethod}
        onChange={setAcquisitionMethod}
        formatLabel={formatMethodLabel}
      />
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
  purchaseTitle: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
}));
