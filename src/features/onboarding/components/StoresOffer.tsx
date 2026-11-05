import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { storeChoiceName } from '#domain/stores';
import { useUsualStores } from '#features/catalog/hooks/useUsualStores';
import { useOnboardingNavigation } from '#features/onboarding/screens/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

const NAMES_SHOWN = 3;

/**
 * Offers to add the stores the household shops at, and once it has some,
 * names them. A receipt's store is one of them already.
 */
export const StoresOffer = ({ homeId }: { homeId: string }) => {
  const { t } = useTranslation();
  const { navigateWithinStep } = useOnboardingNavigation();
  const { stores } = useUsualStores(homeId, { fetchPolicy: 'cache-first' });
  const names = [
    ...new Set(stores?.map(({ choice }) => storeChoiceName(choice, t))),
  ];
  const shown = names.slice(0, NAMES_SHOWN).join(', ');
  const more = names.length - NAMES_SHOWN;

  return (
    <View style={styles.offer} testID={onboardingTestIDs.stores}>
      {names.length > 0 ? (
        <Text role="body" tone="secondary" align="center">
          {more > 0
            ? t('onBoarding.yourStoresAndMore', { names: shown, count: more })
            : t('onBoarding.yourStores', { names: shown })}
        </Text>
      ) : null}
      <Button
        title={
          names.length > 0
            ? t('onBoarding.addMoreStores')
            : t('onBoarding.addStores')
        }
        icon="storefront-outline"
        onPress={() => {
          navigateWithinStep('OnboardingStores', { homeId });
        }}
        variant="outline"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  offer: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
}));
