import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FormInput } from '#components/molecules/FormInput';
import { StoreAutocompleteField } from '#components/molecules/AutocompleteField/StoreAutocompleteField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Text } from '#components/atoms/Text';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import {
  ACQUISITION_METHOD_OPTIONS,
  acquisitionMethodLabelKey,
} from '#/utils/items/itemEnumLabels';
import { localizeNumericHint } from '#/utils/formatters/number';

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
  const formatMethodLabel = (value: AcquisitionMethod) =>
    t(acquisitionMethodLabelKey(value));
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

      <DropdownStack>
        <View style={styles.section}>
          <StoreAutocompleteField
            variant="inline"
            label={t('addToPantry.store')}
            value={storeName}
            onChangeText={setStoreName}
            placeholder={t('addToPantry.storePlaceholder')}
            onStoreSelected={handleStoreSelected}
            helperText={t('labels.storeSelectHint')}
          />
        </View>

        <FormInput
          label={t('addToPantry.cost')}
          value={costPerUnit}
          onChangeText={setCostPerUnit}
          placeholder={localizeNumericHint(t('addToPantry.costPlaceholder'))}
          keyboardType="decimal-pad"
          useBottomSheetInput
        />

        <SegmentedControl
          label={t('addToPantry.acquisitionMethod')}
          options={ACQUISITION_METHOD_OPTIONS}
          value={acquisitionMethod}
          onChange={setAcquisitionMethod}
          formatLabel={formatMethodLabel}
        />
      </DropdownStack>
    </BottomSheetKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  ...detailsPageBaseStyles(theme),
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
}));
