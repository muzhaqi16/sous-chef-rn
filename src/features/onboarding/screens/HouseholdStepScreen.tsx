import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Reveal } from '#components/atoms/Reveal';
import { RowCard } from '#components/atoms/RowCard';
import { Text } from '#components/atoms/Text';
import { RadioRow } from '#components/molecules/RadioRow';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import { COOKS_FOR_MAX, FAMILY_DEFAULT, FAMILY_MIN } from '#domain/servings';
import { hitSlop } from '#/theme/foundations/sizes';
import { OnboardingStepScaffold } from '#features/onboarding/components/OnboardingStepScaffold';
import { useHouseholdAnswer } from '#features/onboarding/hooks/useHouseholdAnswer';
import { useHouseholdGreeting } from '#features/onboarding/hooks/useHouseholdGreeting';
import { RenameHomeDialog } from '#features/onboarding/components/RenameHomeDialog';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';

/**
 * The first question: a greeting by name and the home's name, then who the
 * user cooks for, one or two answered in a tap, a family with its count.
 */
export const HouseholdStepScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('HouseholdStepScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const greeting = useHouseholdGreeting();
  const [renaming, setRenaming] = useState(false);
  const { answer: saveAnswer, saved } = useHouseholdAnswer();
  const [family, setFamily] = useState(false);
  const [familySize, setFamilySize] = useState(FAMILY_DEFAULT);
  // A saved family count reopens the family answer once, when it arrives.
  const [seededFromSaved, setSeededFromSaved] = useState(false);
  if (!seededFromSaved && saved !== null) {
    setSeededFromSaved(true);
    if (saved >= FAMILY_MIN) {
      setFamily(true);
      setFamilySize(saved);
    }
  }
  // The count being saved: its row reads as chosen until the step moves on.
  const [saving, setSaving] = useState<number | null>(null);
  // The row read as chosen: the one being saved, else the saved answer.
  const chosen = saving ?? (family ? null : saved);
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
    <OnboardingStepScaffold
      onSkip={() => navigateToNextStep('Household')}
      primary={
        family
          ? {
              label: t('labels.continue'),
              onPress: () => {
                void answer(familySize);
              },
              loading: saving !== null,
            }
          : undefined
      }
      testID={onboardingTestIDs.householdScreen}
    >
      <View
        style={styles.greeting}
        testID={onboardingTestIDs.householdGreeting}
      >
        <Text role="heading" align="center">
          {greeting.firstName
            ? t('onBoarding.greeting', { name: greeting.firstName })
            : t('onBoarding.greetingNoName')}
        </Text>
        {/* The line keeps its height while the home loads, so the choices
            below never move under a finger. */}
        {greeting.canRename && greeting.homeName ? (
          <AppPressable
            onPress={() => setRenaming(true)}
            accessibilityRole="button"
            accessibilityHint={t('onBoarding.homeNameHint')}
            hitSlop={hitSlop.md}
            style={styles.homeName}
            testID={onboardingTestIDs.householdHomeName}
          >
            <Text role="bodyStrong" tone="accent">
              {greeting.homeName}
            </Text>
            <Icon name="pencil-outline" size="sm" tone="primary" />
          </AppPressable>
        ) : (
          <Text
            role="bodyStrong"
            tone="secondary"
            align="center"
            style={styles.homeName}
            testID={onboardingTestIDs.householdHomeName}
          >
            {greeting.homeName ?? ' '}
          </Text>
        )}
        <Text role="title" align="center" style={styles.question}>
          {t('onBoarding.householdTitle')}
        </Text>
        <Text role="body" tone="secondary" align="center">
          {t('onBoarding.householdSubtitle')}
        </Text>
      </View>
      <RenameHomeDialog
        visible={renaming}
        currentName={greeting.homeName ?? ''}
        onClose={() => setRenaming(false)}
        onRename={name =>
          greeting.rename(name, t('errors.updateHomeNameFailed'))
        }
      />
      <View>
        <RowCard>
          <RadioRow
            selected={chosen === 1}
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
            selected={chosen === 2}
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
        <Reveal open={family}>
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
        </Reveal>
      </View>
    </OnboardingStepScaffold>
  );
};

const styles = StyleSheet.create(theme => ({
  greeting: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  homeName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.button.sm,
  },
  question: {
    marginTop: theme.spacing.md,
  },
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
