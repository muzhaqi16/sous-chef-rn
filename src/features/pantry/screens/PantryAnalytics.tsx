import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { ModeTabs } from '#components/molecules/ModeTabs';
import { DateRangeFilter } from '#features/pantry/components/analytics/DateRangeFilter';
import type { StaticScreenProps } from '@react-navigation/native';
import { UsageTab } from '#features/pantry/components/analyticsTabs/UsageTab';
import { WasteTab } from '#features/pantry/components/analyticsTabs/WasteTab';
import { LedgerTab } from '#features/pantry/components/analyticsTabs/LedgerTab';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { SubScreen } from '#components/templates/SubScreen';

type PantryAnalyticsProps = StaticScreenProps<{
  pantryId: string;
}>;

type AnalyticsTab = 'usage' | 'waste' | 'ledger';

const ANALYTICS_TABS: readonly AnalyticsTab[] = ['usage', 'waste', 'ledger'];

const TAB_LABEL_KEYS: Record<AnalyticsTab, TranslationKey> = {
  usage: 'labels.usage',
  waste: 'pantryAnalytics.tabWaste',
  ledger: 'pantryAnalytics.tabLedger',
};

export const PantryAnalytics: React.FC<PantryAnalyticsProps> = ({ route }) => {
  useScreenTransition('PantryAnalytics');
  const { t } = useTranslation();
  const { pantryId } = route.params;

  const {
    usageData,
    wasteData,
    ledgerData,
    usageLoading,
    wasteLoading,
    ledgerLoading,
    usageError,
    wasteError,
    ledgerError,
    usageOffline,
    wasteOffline,
    ledgerOffline,
    dateRange,
    setDateRange,
    ledgerGranularity,
    setLedgerGranularity,
    refetch,
  } = usePantryAnalytics({ pantryId });

  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<AnalyticsTab>('usage');

  // The offline state offers a Refresh button, so this fires precisely when the
  // refetch is most likely to fail. `executeRefreshWithFinally` guarantees the
  // spinner is cleared either way (try/finally is banned in component bodies —
  // it makes the React Compiler bail out of the whole component).
  const handleRefresh = () => {
    void executeRefreshWithFinally(refetch, setRefreshing);
  };

  const renderScene = () => {
    switch (tab) {
      case 'usage':
        return (
          <UsageTab
            usageData={usageData}
            usageLoading={usageLoading}
            usageError={usageError}
            usageOffline={usageOffline}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'waste':
        return (
          <WasteTab
            wasteData={wasteData}
            wasteLoading={wasteLoading}
            wasteError={wasteError}
            wasteOffline={wasteOffline}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'ledger':
        return (
          <LedgerTab
            ledgerData={ledgerData}
            ledgerLoading={ledgerLoading}
            ledgerError={ledgerError}
            ledgerOffline={ledgerOffline}
            ledgerGranularity={ledgerGranularity}
            setLedgerGranularity={setLedgerGranularity}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
    }
  };

  return (
    <SubScreen
      title={t('pantryAnalytics.title')}
      // The chip row and every tab scene are the scrollables, each insetting its
      // own content; a page gutter would clip them and double the inset.
      scroll="list"
      gutter="none"
    >
      {/* Date Range Filter */}
      <DateRangeFilter selected={dateRange} onSelect={setDateRange} />

      <View style={styles.tabs}>
        <ModeTabs
          options={ANALYTICS_TABS}
          value={tab}
          onChange={setTab}
          formatLabel={value => t(TAB_LABEL_KEYS[value])}
        />
      </View>
      <View style={styles.scene}>{renderScene()}</View>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  tabs: {
    paddingHorizontal: theme.spacing.md,
  },
  scene: {
    flex: 1,
  },
}));
