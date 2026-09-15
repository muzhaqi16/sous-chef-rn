import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { kitTestIDs } from '#components/testIDs';

export const SplashScreen = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID={kitTestIDs.splashScreen}>
      <SousChefLoader
        size="large"
        message={t('labels.loading')}
        showBrand={true}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
