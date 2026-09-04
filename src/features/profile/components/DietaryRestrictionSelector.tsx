import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { RestrictionSection } from '#features/profile/components/RestrictionSection/RestrictionSection';
import { MultiSelectChipSheet } from '#components/organisms/MultiSelectChipSheet/MultiSelectChipSheet';
import {
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { isLifestyleDiet } from '#domain/dietary';
import { executeWriteWithFinally } from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';

// Lifestyle dietary choices. Labels are i18n keys resolved via `t()` at render —
// the enum value stays the stable identity used for selection and persistence.
const DIETS: { labelKey: string; value: Diet }[] = [
  { labelKey: 'dietaryProfile.diets.vegetarian', value: Diet.Vegetarian },
  { labelKey: 'dietaryProfile.diets.vegan', value: Diet.Vegan },
  { labelKey: 'recipes.diet.GLUTEN_FREE', value: Diet.GlutenFree },
  { labelKey: 'recipes.diet.KETO', value: Diet.Keto },
  { labelKey: 'recipes.diet.PALEO', value: Diet.Paleo },
  { labelKey: 'dietaryProfile.diets.pescetarian', value: Diet.Pescetarian },
  {
    labelKey: 'dietaryProfile.diets.lactoVegetarian',
    value: Diet.LactoVegetarian,
  },
  { labelKey: 'dietaryProfile.diets.ovoVegetarian', value: Diet.OvoVegetarian },
  { labelKey: 'dietaryProfile.diets.primal', value: Diet.Primal },
  { labelKey: 'labels.lowFodmap', value: Diet.LowFodmap },
  { labelKey: 'recipes.diet.WHOLE30', value: Diet.Whole30 },
];

// Mutually-exclusive lifestyle diets (single-select) vs stackable constraints
// (multi-select), derived from the shared classification.
const LIFESTYLE_DIETS = DIETS.filter(d => isLifestyleDiet(d.value));
const CONSTRAINT_DIETS = DIETS.filter(d => !isLifestyleDiet(d.value));

// Allergies and intolerances
const INTOLERANCES: { labelKey: string; value: Intolerance }[] = [
  { labelKey: 'recipes.intolerance.DAIRY', value: Intolerance.Dairy },
  { labelKey: 'dietaryProfile.intolerances.egg', value: Intolerance.Egg },
  { labelKey: 'recipes.intolerance.GLUTEN', value: Intolerance.Gluten },
  { labelKey: 'recipes.intolerance.GRAIN', value: Intolerance.Grain },
  { labelKey: 'recipes.intolerance.PEANUT', value: Intolerance.Peanut },
  {
    labelKey: 'recipes.intolerance.SEAFOOD',
    value: Intolerance.Seafood,
  },
  { labelKey: 'recipes.intolerance.SESAME', value: Intolerance.Sesame },
  {
    labelKey: 'recipes.intolerance.SHELLFISH',
    value: Intolerance.Shellfish,
  },
  { labelKey: 'recipes.intolerance.SOY', value: Intolerance.Soy },
  {
    labelKey: 'dietaryProfile.intolerances.sulfite',
    value: Intolerance.Sulfite,
  },
  {
    labelKey: 'recipes.intolerance.TREE_NUT',
    value: Intolerance.TreeNut,
  },
  { labelKey: 'recipes.intolerance.WHEAT', value: Intolerance.Wheat },
  { labelKey: 'recipes.intolerance.FISH', value: Intolerance.Fish },
];

// Nutritional objectives
const HEALTH_GOALS: { labelKey: string; value: HealthGoal }[] = [
  { labelKey: 'recipes.healthGoal.LOW_CARB', value: HealthGoal.LowCarb },
  {
    labelKey: 'recipes.healthGoal.HIGH_PROTEIN',
    value: HealthGoal.HighProtein,
  },
  { labelKey: 'recipes.healthGoal.LOW_SODIUM', value: HealthGoal.LowSodium },
  { labelKey: 'recipes.healthGoal.SUGAR_FREE', value: HealthGoal.SugarFree },
  {
    labelKey: 'recipes.healthGoal.DIABETIC_FRIENDLY',
    value: HealthGoal.DiabeticFriendly,
  },
  {
    labelKey: 'recipes.healthGoal.HEART_HEALTHY',
    value: HealthGoal.HeartHealthy,
  },
];

type RestrictionType = {
  diet?: Diet;
  intolerance?: Intolerance;
  healthGoal?: HealthGoal;
};

type DietaryRestrictionSelectorProps = {
  existingRestrictions: {
    id: string;
    diet?: Diet | null;
    intolerance?: Intolerance | null;
    healthGoal?: HealthGoal | null;
  }[];
  onAdd: (
    restrictions: RestrictionType[],
    severity: RestrictionSeverity,
  ) => Promise<boolean>;
  onRemove: (id: string) => void;
  /** Set the single lifestyle diet, removing any prior lifestyle row(s). The
   *  `replaceIds` are the existing lifestyle restriction ids to clear once the
   *  new diet is added. */
  onSelectLifestyleDiet: (diet: Diet, replaceIds: string[]) => Promise<boolean>;
};

export const DietaryRestrictionSelector: React.FC<
  DietaryRestrictionSelectorProps
> = ({ existingRestrictions, onAdd, onRemove, onSelectLifestyleDiet }) => {
  const { t } = useTranslation();

  // Sheet visibility states
  const [isDietSheetVisible, setDietSheetVisible] = useState(false);
  const [isConstraintSheetVisible, setConstraintSheetVisible] = useState(false);
  const [isIntoleranceSheetVisible, setIntoleranceSheetVisible] =
    useState(false);
  const [isGoalSheetVisible, setGoalSheetVisible] = useState(false);

  // Local selection states for each sheet
  const [selectedDietIds, setSelectedDietIds] = useState<Diet[]>([]);
  const [selectedConstraintIds, setSelectedConstraintIds] = useState<Diet[]>(
    [],
  );
  const [selectedIntoleranceIds, setSelectedIntoleranceIds] = useState<
    Intolerance[]
  >([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<HealthGoal[]>([]);

  // Saving states
  const [isSavingDiets, setIsSavingDiets] = useState(false);
  const [isSavingConstraints, setIsSavingConstraints] = useState(false);
  const [isSavingIntolerances, setIsSavingIntolerances] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);

  // Derive existing restrictions, split into lifestyle vs constraint diets
  const existingLifestyleRows = existingRestrictions.filter(
    r => r.diet && isLifestyleDiet(r.diet),
  );
  const currentLifestyleDiet = existingLifestyleRows[0]?.diet ?? null;
  const existingConstraintRows = existingRestrictions.filter(
    r => r.diet && !isLifestyleDiet(r.diet),
  );
  const existingIntolerances = existingRestrictions
    .map(r => r.intolerance)
    .filter(Boolean) as Intolerance[];
  const existingHealthGoals = existingRestrictions
    .map(r => r.healthGoal)
    .filter(Boolean) as HealthGoal[];

  // Resolve an option's localized label, falling back to the raw enum value so
  // an unrecognized restriction still renders something readable.
  const labelFor = <T extends string>(
    options: { labelKey: string; value: T }[],
    value: T,
  ): string => {
    const match = options.find(o => o.value === value);
    return match ? t(match.labelKey) : value;
  };

  // Map existing restrictions to display items
  const existingLifestyleItems = existingLifestyleRows.map(r => ({
    id: r.id,
    label: labelFor(DIETS, r.diet!),
  }));

  const existingConstraintItems = existingConstraintRows.map(r => ({
    id: r.id,
    label: labelFor(DIETS, r.diet!),
  }));

  const existingIntoleranceItems = existingRestrictions
    .filter(r => r.intolerance)
    .map(r => ({
      id: r.id,
      label: labelFor(INTOLERANCES, r.intolerance!),
    }));

  const existingGoalItems = existingRestrictions
    .filter(r => r.healthGoal)
    .map(r => ({
      id: r.id,
      label: labelFor(HEALTH_GOALS, r.healthGoal!),
    }));

  // Prepare available items for sheets. Lifestyle shows all options (including
  // the current pick) so the user can switch; constraints/intolerances/goals
  // exclude what's already added.
  const availableLifestyle = LIFESTYLE_DIETS.map(d => ({
    id: d.value,
    label: t(d.labelKey),
  }));

  const existingConstraintValues = existingConstraintRows
    .map(r => r.diet)
    .filter(Boolean) as Diet[];
  const availableConstraints = CONSTRAINT_DIETS.filter(
    d => !existingConstraintValues.includes(d.value),
  ).map(d => ({ id: d.value, label: t(d.labelKey) }));

  const availableIntolerances = INTOLERANCES.filter(
    i => !existingIntolerances.includes(i.value),
  ).map(i => ({
    id: i.value,
    label: t(i.labelKey),
  }));

  const availableGoals = HEALTH_GOALS.filter(
    h => !existingHealthGoals.includes(h.value),
  ).map(h => ({
    id: h.value,
    label: t(h.labelKey),
  }));

  // Handle opening sheets
  const handleOpenDietSheet = () => {
    setSelectedDietIds(currentLifestyleDiet ? [currentLifestyleDiet] : []);
    setDietSheetVisible(true);
  };

  const handleOpenConstraintSheet = () => {
    setSelectedConstraintIds([]);
    setConstraintSheetVisible(true);
  };

  const handleOpenIntoleranceSheet = () => {
    setSelectedIntoleranceIds([]);
    setIntoleranceSheetVisible(true);
  };

  const handleOpenGoalSheet = () => {
    setSelectedGoalIds([]);
    setGoalSheetVisible(true);
  };

  // Each save below already alerts when the mutation RESOLVES unsuccessfully.
  // This covers the other route — a throw — which the finalizer would otherwise
  // swallow, clearing the spinner with nothing shown. Same copy either way, so
  // the user sees one message for one failure however it arrived.
  const alertWriteFailed = (body: string) => (error: unknown) => {
    logger.error('Dietary restriction write threw', { error });
    alertService.alert(t('labels.error'), body);
  };

  // Save handlers
  const handleSaveDiet = () => {
    const selected = selectedDietIds[0];
    // No change (nothing picked, or re-picked the current diet) — just close.
    if (!selected || selected === currentLifestyleDiet) {
      setDietSheetVisible(false);
      return;
    }

    executeWriteWithFinally(
      async () => {
        const replaceIds = existingLifestyleRows.map(r => r.id);
        const success = await onSelectLifestyleDiet(selected, replaceIds);

        if (success) {
          setSelectedDietIds([]);
          setDietSheetVisible(false);
        } else {
          alertService.alert(
            t('labels.error'),
            t('dietaryProfile.updateDietFailed'),
          );
        }
      },
      setIsSavingDiets,
      alertWriteFailed(t('dietaryProfile.updateDietFailed')),
    );
  };

  const handleSaveConstraints = () => {
    if (selectedConstraintIds.length === 0) {
      setConstraintSheetVisible(false);
      return;
    }

    executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionType[] = selectedConstraintIds.map(
          diet => ({ diet }),
        );

        const success = await onAdd(
          restrictions,
          RestrictionSeverity.Preference,
        );

        if (success) {
          setSelectedConstraintIds([]);
          setConstraintSheetVisible(false);
        } else {
          alertService.alert(
            t('labels.error'),
            t('dietaryProfile.addConstraintsFailed'),
          );
        }
      },
      setIsSavingConstraints,
      alertWriteFailed(t('dietaryProfile.addConstraintsFailed')),
    );
  };

  const handleSaveIntolerances = () => {
    if (selectedIntoleranceIds.length === 0) {
      setIntoleranceSheetVisible(false);
      return;
    }

    executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionType[] = selectedIntoleranceIds.map(
          intolerance => ({
            intolerance,
          }),
        );

        const success = await onAdd(
          restrictions,
          RestrictionSeverity.Intolerance,
        );

        if (success) {
          setSelectedIntoleranceIds([]);
          setIntoleranceSheetVisible(false);
        } else {
          alertService.alert(
            t('labels.error'),
            t('dietaryProfile.addIntolerancesFailed'),
          );
        }
      },
      setIsSavingIntolerances,
      alertWriteFailed(t('dietaryProfile.addIntolerancesFailed')),
    );
  };

  const handleSaveGoals = () => {
    if (selectedGoalIds.length === 0) {
      setGoalSheetVisible(false);
      return;
    }

    executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionType[] = selectedGoalIds.map(
          healthGoal => ({
            healthGoal,
          }),
        );

        const success = await onAdd(restrictions, RestrictionSeverity.Goal);

        if (success) {
          setSelectedGoalIds([]);
          setGoalSheetVisible(false);
        } else {
          alertService.alert(
            t('labels.error'),
            t('dietaryProfile.addGoalsFailed'),
          );
        }
      },
      setIsSavingGoals,
      alertWriteFailed(t('dietaryProfile.addGoalsFailed')),
    );
  };

  return (
    <View style={styles.container}>
      {/* Diet Section (single lifestyle diet) */}
      <RestrictionSection
        title={t('labels.diet')}
        existingItems={existingLifestyleItems}
        onRemove={onRemove}
        onAddPress={handleOpenDietSheet}
        emptyMessage={t('dietaryProfile.dietEmpty')}
      />

      {/* Dietary Constraints Section (stackable) */}
      <RestrictionSection
        title={t('dietaryProfile.constraintsTitle')}
        existingItems={existingConstraintItems}
        onRemove={onRemove}
        onAddPress={handleOpenConstraintSheet}
        emptyMessage={t('dietaryProfile.constraintsEmpty')}
      />

      {/* Intolerances Section */}
      <RestrictionSection
        title={t('labels.allergiesIntolerances')}
        existingItems={existingIntoleranceItems}
        onRemove={onRemove}
        onAddPress={handleOpenIntoleranceSheet}
        emptyMessage={t('dietaryProfile.intolerancesEmpty')}
      />

      {/* Health Goals Section */}
      <RestrictionSection
        title={t('dietaryProfile.goalsTitle')}
        existingItems={existingGoalItems}
        onRemove={onRemove}
        onAddPress={handleOpenGoalSheet}
        emptyMessage={t('dietaryProfile.goalsEmpty')}
      />

      {/* Diet Selection Sheet (single-select) */}
      <MultiSelectChipSheet
        visible={isDietSheetVisible}
        title={t('dietaryProfile.dietSheetTitle')}
        items={availableLifestyle}
        selectedItems={selectedDietIds}
        onSelect={setSelectedDietIds}
        onClose={() => setDietSheetVisible(false)}
        onDone={handleSaveDiet}
        loading={isSavingDiets}
        singleSelect
      />

      {/* Dietary Constraints Selection Sheet */}
      <MultiSelectChipSheet
        visible={isConstraintSheetVisible}
        title={t('dietaryProfile.constraintsSheetTitle')}
        items={availableConstraints}
        selectedItems={selectedConstraintIds}
        onSelect={setSelectedConstraintIds}
        onClose={() => setConstraintSheetVisible(false)}
        onDone={handleSaveConstraints}
        loading={isSavingConstraints}
      />

      {/* Intolerance Selection Sheet */}
      <MultiSelectChipSheet
        visible={isIntoleranceSheetVisible}
        title={t('dietaryProfile.intolerancesSheetTitle')}
        items={availableIntolerances}
        selectedItems={selectedIntoleranceIds}
        onSelect={setSelectedIntoleranceIds}
        onClose={() => setIntoleranceSheetVisible(false)}
        onDone={handleSaveIntolerances}
        loading={isSavingIntolerances}
      />

      {/* Health Goal Selection Sheet */}
      <MultiSelectChipSheet
        visible={isGoalSheetVisible}
        title={t('dietaryProfile.goalsSheetTitle')}
        items={availableGoals}
        selectedItems={selectedGoalIds}
        onSelect={setSelectedGoalIds}
        onClose={() => setGoalSheetVisible(false)}
        onDone={handleSaveGoals}
        loading={isSavingGoals}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    marginBottom: 0,
  },
}));
