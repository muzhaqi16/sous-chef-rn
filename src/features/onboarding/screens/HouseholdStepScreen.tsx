import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { RowCard } from '#components/atoms/RowCard';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { RadioRow } from '#components/molecules/RadioRow';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import { COOKS_FOR_MAX, FAMILY_DEFAULT, FAMILY_MIN } from '#domain/servings';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { useHouseholdAnswer } from '#features/onboarding/hooks/useHouseholdAnswer';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';

/** Who the user cooks for: one or two answers in a tap, a family with its count. */
export const HouseholdStepScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('HouseholdStepScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const { answer: saveAnswer } = useHouseholdAnswer();
  const [family, setFamily] = useState(false);
  const [familySize, setFamilySize] = useState(FAMILY_DEFAULT);
  // The count being saved: its row reads as chosen until the step moves on.
  const [saving, setSaving] = useState<number | null>(null);
  // Back on this step, the question is open again.
  const isFocused = useIsScreenFocused();
  const [wasFocused, setWasFocused] = useState(isFocused);
  if (isFocused !== wasFocused) {
    setWasFocused(isFocused);
    if (isFocused) setSaving(null);
  }

  const answer = async (count: number) => {
    setSaving(count);
    await saveAnswer(count);
    navigateToNextStep('Household');
  };
  const changeSize = (delta: number) =>
    setFamilySize(size =>
      Math.min(COOKS_FOR_MAX, Math.max(FAMILY_MIN, size + delta)),
    );
  const sizeLabel = t('onBoarding.householdPeople', { count: familySize });

  return (
    <OnBoardingWrapper
      title={t('onBoarding.householdTitle')}
      subtitle={t('onBoarding.householdSubtitle')}
      onSkip={() => navigateToNextStep('Household')}
      primaryAction={
        family ? (
          <Button
            title={t('labels.continue')}
            onPress={() => {
              void answer(familySize);
            }}
            variant="primary"
            loading={saving !== null}
          />
        ) : undefined
      }
      testID={onboardingTestIDs.householdScreen}
    >
      <View>
        <RowCard>
          <RadioRow
            selected={saving === 1}
            disabled={saving !== null}
            onPress={() => {
              void answer(1);
            }}
            style={styles.choice}
            testID={onboardingTestIDs.householdChoice('one')}
          >
            <Text role="body">{t('onBoarding.householdJustMe')}</Text>
          </RadioRow>
        </RowCard>
        <RowCard>
          <RadioRow
            selected={saving === 2}
            disabled={saving !== null}
            onPress={() => {
              void answer(2);
            }}
            style={styles.choice}
            testID={onboardingTestIDs.householdChoice('two')}
          >
            <Text role="body">{t('onBoarding.householdTwo')}</Text>
          </RadioRow>
        </RowCard>
        <RowCard>
          <RadioRow
            selected={family}
            disabled={saving !== null}
            onPress={() => setFamily(true)}
            style={styles.choice}
            testID={onboardingTestIDs.householdChoice('family')}
          >
            <Text role="body">{t('onBoarding.householdFamily')}</Text>
          </RadioRow>
        </RowCard>
        {family ? (
          <View
            style={styles.stepper}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('onBoarding.householdFamily')}
            accessibilityValue={{ text: sizeLabel }}
            accessibilityActions={[
              { name: 'increment' },
              { name: 'decrement' },
            ]}
            onAccessibilityAction={event =>
              changeSize(event.nativeEvent.actionName === 'increment' ? 1 : -1)
            }
          >
            <AppPressable
              onPress={() => changeSize(-1)}
              disabled={familySize <= FAMILY_MIN}
              accessibilityLabel={t('onBoarding.householdFewer')}
              style={styles.stepperButton}
              testID={onboardingTestIDs.householdFewer}
            >
              <Icon
                name="remove-circle-outline"
                size={32}
                tone={familySize <= FAMILY_MIN ? 'textTertiary' : 'primary'}
              />
            </AppPressable>
            <Text role="subheading" style={styles.stepperValue}>
              {sizeLabel}
            </Text>
            <AppPressable
              onPress={() => changeSize(1)}
              disabled={familySize >= COOKS_FOR_MAX}
              accessibilityLabel={t('onBoarding.householdMore')}
              style={styles.stepperButton}
              testID={onboardingTestIDs.householdMore}
            >
              <Icon
                name="add-circle-outline"
                size={32}
                tone={familySize >= COOKS_FOR_MAX ? 'textTertiary' : 'primary'}
              />
            </AppPressable>
          </View>
        ) : null}
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  choice: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  stepperButton: {
    padding: theme.spacing.xs,
  },
  stepperValue: {
    minWidth: 120,
    textAlign: 'center',
  },
}));
