import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useCurrencyPreference } from '#features/profile/hooks/useCurrencyPreference';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';

/**
 * Asked here rather than inferred from the device, and asked BEFORE any screen
 * that can record a cost: the server denominates a cost it is not told the
 * currency of with this answer, and a cost recorded under the wrong one keeps
 * it. Skipping leaves the account on its default.
 */
export const CurrencySetupScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('CurrencySetupScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const { preferredCurrency, options, selectCurrency, saving } =
    useCurrencyPreference();

  const advance = () => navigateToNextStep('CurrencySetup');

  return (
    <OnBoardingWrapper
      subtitle={t('onboardingSteps.CurrencySetup.subtitle')}
      step={2}
      totalSteps={8}
      testID="currency-setup-screen"
    >
      <View style={styles.container}>
        <Text role="caption" tone="secondary" style={styles.hint}>
          {t('settings.currencySubtitle')}
        </Text>

        <View style={styles.list}>
          {options.map(option => {
            const selected = option.value === preferredCurrency;
            return (
              <AppPressable
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => selectCurrency(option.value)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`currency-option-${option.value}`}
              >
                <Text role="body">{option.label}</Text>
                {selected ? (
                  <Icon name="checkmark" size="sm" tone="primary" />
                ) : null}
              </AppPressable>
            );
          })}
        </View>

        <AppPressable
          style={styles.continueButton}
          onPress={advance}
          testID="currency-setup-continue"
        >
          <Text role="bodyStrong" style={styles.continueText}>
            {t('labels.continue')}
          </Text>
        </AppPressable>
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  hint: {
    textAlign: 'center',
  },
  list: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  optionSelected: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  continueButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  continueText: {
    color: theme.colors.onPrimary,
  },
}));
