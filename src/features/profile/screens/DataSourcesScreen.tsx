import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { openWebUrl } from '#utils/externalUrl';
import { profileTestIDs } from '#features/profile/testIDs';

interface DataSource {
  id: 'openFoodFacts' | 'usdaFoodDataCentral' | 'usdaFoodKeeper';
  nameKey: TranslationKey;
  providesKey: TranslationKey;
  licenceKey: TranslationKey;
  url: string;
}

// Open Food Facts' ODbL and CC BY-SA ask for this credit wherever its data is
// shown; the scan result credits each product, this screen the whole catalog.
const SOURCES: readonly DataSource[] = [
  {
    id: 'openFoodFacts',
    nameKey: 'profile.dataSources.openFoodFacts.name',
    providesKey: 'profile.dataSources.openFoodFacts.provides',
    licenceKey: 'profile.dataSources.openFoodFacts.licence',
    url: 'https://world.openfoodfacts.org',
  },
  {
    id: 'usdaFoodDataCentral',
    nameKey: 'profile.dataSources.usdaFoodDataCentral.name',
    providesKey: 'profile.dataSources.usdaFoodDataCentral.provides',
    licenceKey: 'profile.dataSources.publicDomain',
    url: 'https://fdc.nal.usda.gov',
  },
  {
    id: 'usdaFoodKeeper',
    nameKey: 'profile.dataSources.usdaFoodKeeper.name',
    providesKey: 'profile.dataSources.usdaFoodKeeper.provides',
    licenceKey: 'profile.dataSources.publicDomain',
    url: 'https://www.foodsafety.gov/keep-food-safe/foodkeeper-app',
  },
];

export const DataSourcesScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SubScreen
      title={t('profile.dataSources.title')}
      testID={profileTestIDs.dataSourcesScreen}
    >
      <Text role="body" tone="secondary" style={styles.intro}>
        {t('profile.dataSources.intro')}
      </Text>
      {SOURCES.map(source => (
        <SettingsSection
          key={source.id}
          variant="inset"
          title={t(source.nameKey)}
          description={t(source.providesKey)}
        >
          <Text role="caption" tone="secondary" style={styles.licence}>
            {t(source.licenceKey)}
          </Text>
          <AppPressable
            accessibilityRole="link"
            onPress={() => {
              void openWebUrl(source.url);
            }}
            style={styles.link}
            testID={profileTestIDs.dataSourceLink(source.id)}
          >
            <Text role="bodyStrong" tone="accent">
              {t('profile.dataSources.visit')}
            </Text>
          </AppPressable>
        </SettingsSection>
      ))}
    </SubScreen>
  );
};

export default DataSourcesScreen;

const styles = StyleSheet.create(theme => ({
  intro: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  licence: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  link: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
}));
