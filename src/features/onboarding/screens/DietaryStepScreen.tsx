import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import {
  RestrictionSeverity,
  type Diet,
  type Intolerance,
} from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import { Button } from '#components/molecules/Button';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  DIET_OPTIONS,
  INTOLERANCE_OPTIONS_MAJOR_FIRST,
  SEVERITY_LABEL_KEYS,
  isLifestyleDiet,
} from '#domain/dietary';
import { useDietarySharing } from '#features/profile/hooks/useDietarySharing';
import { AvoidFoodSheet } from '#features/profile/ui/AvoidFoodSheet';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import {
  useDietaryIntake,
  type DietarySelection,
} from '#features/onboarding/hooks/useDietaryIntake';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';

type AllergenSeverity = DietarySelection['allergens'][number]['severity'];

/** An allergen's choice: allergy (stricter, so the default) or intolerance. */
const ALLERGEN_SEVERITIES: readonly AllergenSeverity[] = [
  RestrictionSeverity.Allergy,
  RestrictionSeverity.Intolerance,
];

const LIFESTYLE_DIETS = DIET_OPTIONS.filter(option =>
  isLifestyleDiet(option.value),
);

/**
 * Allergies, a diet and foods to avoid, tapped, never typed except for the food
 * search. Nothing starts selected, and nothing is saved until Continue.
 */
export const DietaryStepScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('DietaryStepScreen');
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();
  const { save } = useDietaryIntake();
  const { homes } = useDietarySharing();
  const [allergens, setAllergens] = useState<DietarySelection['allergens']>([]);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [foods, setFoods] = useState<DietarySelection['foods']>([]);
  const [avoidSheetVisible, setAvoidSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggleAllergen = (value: Intolerance) =>
    setAllergens(current =>
      current.some(allergen => allergen.value === value)
        ? current.filter(allergen => allergen.value !== value)
        : [...current, { value, severity: RestrictionSeverity.Allergy }],
    );
  const setSeverity = (value: Intolerance, severity: AllergenSeverity) =>
    setAllergens(current =>
      current.map(allergen =>
        allergen.value === value ? { ...allergen, severity } : allergen,
      ),
    );

  const handleContinue = async () => {
    setSaving(true);
    setFailed(false);
    const saved = await save({ allergens, diet, foods });
    setSaving(false);
    if (saved) navigateToNextStep('Dietary');
    else setFailed(true);
  };

  const sharedHomes = homes.filter(home => home.shared).map(home => home.name);

  return (
    <OnBoardingWrapper
      title={t('onBoarding.dietaryTitle')}
      subtitle={t('onBoarding.dietarySubtitle')}
      onBack={() => navigateToPreviousStep('Dietary')}
      onSkip={() => navigateToNextStep('Dietary')}
      primaryAction={
        <Button
          title={t('labels.continue')}
          onPress={() => {
            void handleContinue();
          }}
          variant="primary"
          loading={saving}
        />
      }
      testID={onboardingTestIDs.dietaryScreen}
    >
      <View style={styles.sections}>
        <Text role="body">{t('dietaryAlerts.checkLabel')}</Text>
        <Text role="body" tone="secondary">
          {sharedHomes.length > 0
            ? t('onBoarding.dietarySharedWith', {
                homes: sharedHomes.join(', '),
              })
            : t('onBoarding.dietarySharingGeneric')}
        </Text>

        <View style={styles.section}>
          <Text role="bodyStrong">{t('onBoarding.dietaryAllergensTitle')}</Text>
          <View style={styles.chips}>
            {INTOLERANCE_OPTIONS_MAJOR_FIRST.map(option => (
              <AnimatedChip
                key={option.value}
                label={t(option.labelKey)}
                selected={allergens.some(
                  allergen => allergen.value === option.value,
                )}
                onPress={() => toggleAllergen(option.value)}
              />
            ))}
          </View>
          {allergens.map(allergen => {
            const option = INTOLERANCE_OPTIONS_MAJOR_FIRST.find(
              candidate => candidate.value === allergen.value,
            );
            return (
              <SegmentedControl
                key={allergen.value}
                label={option ? t(option.labelKey) : t('labels.unknown')}
                options={ALLERGEN_SEVERITIES}
                value={allergen.severity}
                onChange={severity => setSeverity(allergen.value, severity)}
                formatLabel={severity => {
                  const key = SEVERITY_LABEL_KEYS[severity];
                  return key ? t(key) : t('labels.unknown');
                }}
                size="compact"
                testID={onboardingTestIDs.dietarySeverity(allergen.value)}
              />
            );
          })}
        </View>

        <View style={styles.section}>
          <Text role="bodyStrong">{t('onBoarding.dietaryDietTitle')}</Text>
          <View style={styles.chips}>
            {LIFESTYLE_DIETS.map(option => (
              <AnimatedChip
                key={option.value}
                label={t(option.labelKey)}
                selected={diet === option.value}
                onPress={() =>
                  setDiet(current =>
                    current === option.value ? null : option.value,
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text role="bodyStrong">{t('dietaryProfile.avoidTitle')}</Text>
          {foods.length > 0 ? (
            <View style={styles.chips}>
              {foods.map(food => (
                <AnimatedChip
                  key={food.id}
                  label={food.name}
                  selected
                  onPress={() =>
                    setFoods(current =>
                      current.filter(picked => picked.id !== food.id),
                    )
                  }
                />
              ))}
            </View>
          ) : null}
          <Button
            title={t('dietaryProfile.avoidSheetTitle')}
            icon="add"
            onPress={() => setAvoidSheetVisible(true)}
            variant="outline"
            testID={onboardingTestIDs.dietaryAddFood}
          />
        </View>

        {failed ? (
          <Text role="error" tone="error">
            {t('onBoarding.dietarySaveFailed')}
          </Text>
        ) : null}
      </View>
      {/* A sheet, so the search's results stay above the keyboard. */}
      <AvoidFoodSheet
        visible={avoidSheetVisible}
        onDismiss={() => setAvoidSheetVisible(false)}
        onPick={(food, severity) => {
          setFoods(current => [
            ...current.filter(picked => picked.id !== food.id),
            { id: food.id, name: food.name, severity },
          ]);
          return Promise.resolve(true);
        }}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  sections: {
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
}));
