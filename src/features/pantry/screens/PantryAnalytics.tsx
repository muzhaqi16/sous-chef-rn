import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import type { TabRoute } from '#features/pantry/components/TabView/TabView';
import { TabView } from '#features/pantry/components/TabView/TabView';
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

  // The offline state offers a Refresh button, so this fires precisely when the
  // refetch is most likely to fail. `executeRefreshWithFinally` guarantees the
  // spinner is cleared either way (try/finally is banned in component bodies —
  // it makes the React Compiler bail out of the whole component).
  const handleRefresh = () => {
    void executeRefreshWithFinally(refetch, setRefreshing);
  };

  const routes: TabRoute[] = [
    { key: 'usage', title: t('labels.usage') },
    { key: 'waste', title: t('pantryAnalytics.tabWaste') },
    { key: 'ledger', title: t('pantryAnalytics.tabLedger') },
  ];

  const renderScene = ({ route: tabRoute }: { route: TabRoute }) => {
    switch (tabRoute.key) {
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
      default:
        return null;
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

      {/* Tab View */}
      <TabView routes={routes} renderScene={renderScene} />
    </SubScreen>
  );
};
