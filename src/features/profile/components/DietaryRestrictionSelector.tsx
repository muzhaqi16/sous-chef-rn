import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import {
  RestrictionSection,
  type RestrictionSectionItem,
} from '#features/profile/components/RestrictionSection/RestrictionSection';
import { MultiSelectChipSheet } from '#components/organisms/MultiSelectChipSheet/MultiSelectChipSheet';
import { AvoidFoodSheet } from '#features/profile/ui/AvoidFoodSheet';
import type {
  Diet,
  Intolerance,
  HealthGoal,
} from '#/graphql/generated/schemaTypes';
import {
  RestrictionSeverity,
  type RestrictionKindInput,
} from '#/graphql/generated/schemaTypes';
import {
  DIET_OPTIONS,
  HEALTH_GOAL_OPTIONS,
  INTOLERANCE_OPTIONS,
  isLifestyleDiet,
  restrictionLabelKey,
  withDietPicked,
} from '#domain/dietary';
import { executeWriteWithFinally } from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';

// Diets held one per group (an animal-food diet, an eating style) vs stackable
// constraints, derived from the shared classification.
const LIFESTYLE_DIETS = DIET_OPTIONS.filter(d => isLifestyleDiet(d.value));
const CONSTRAINT_DIETS = DIET_OPTIONS.filter(d => !isLifestyleDiet(d.value));

type DietaryRestrictionSelectorProps = {
  existingRestrictions: {
    id: string;
    diet?: Diet | null;
    intolerance?: Intolerance | null;
    healthGoal?: HealthGoal | null;
    item?: { id: string; name: string } | null;
    severity: RestrictionSeverity;
  }[];
  onAdd: (
    restrictions: RestrictionKindInput[],
    severity: RestrictionSeverity,
  ) => Promise<boolean>;
  onRemove: (item: RestrictionSectionItem) => void;
  /** Adds the diets picked, then removes the rows of those dropped. */
  onChangeDiets: (added: Diet[], removedIds: string[]) => Promise<boolean>;
};

export const DietaryRestrictionSelector: React.FC<
  DietaryRestrictionSelectorProps
> = ({ existingRestrictions, onAdd, onRemove, onChangeDiets }) => {
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
  const currentLifestyleDiets = existingLifestyleRows.flatMap(r =>
    r.diet ? [r.diet] : [],
  );
  const existingConstraintRows = existingRestrictions.filter(
    r => r.diet && !isLifestyleDiet(r.diet),
  );
  const existingIntolerances = existingRestrictions.flatMap(r =>
    r.intolerance ? [r.intolerance] : [],
  );
  const existingHealthGoals = existingRestrictions.flatMap(r =>
    r.healthGoal ? [r.healthGoal] : [],
  );

  // Map existing restrictions to display items
  const existingLifestyleItems = existingLifestyleRows.flatMap(r =>
    r.diet ? [{ id: r.id, label: t(restrictionLabelKey(r)) }] : [],
  );

  const existingConstraintItems = existingConstraintRows.flatMap(r =>
    r.diet ? [{ id: r.id, label: t(restrictionLabelKey(r)) }] : [],
  );

  // An allergen or avoided food says how strict it is: the profile is where
  // the user checks what onboarding and the avoid sheet saved.
  const withSeverity = (name: string, severity: RestrictionSeverity) =>
    severity === RestrictionSeverity.Allergy
      ? t('dietaryProfile.avoidAllergy', { name })
      : severity === RestrictionSeverity.Intolerance
      ? t('dietaryProfile.avoidIntolerance', { name })
      : name;

  const existingIntoleranceItems = existingRestrictions.flatMap(r =>
    r.intolerance
      ? [
          {
            id: r.id,
            label: withSeverity(t(restrictionLabelKey(r)), r.severity),
          },
        ]
      : [],
  );

  const existingGoalItems = existingRestrictions.flatMap(r =>
    r.healthGoal ? [{ id: r.id, label: t(restrictionLabelKey(r)) }] : [],
  );

  const existingAvoidItems = existingRestrictions.flatMap(r =>
    r.item ? [{ id: r.id, label: withSeverity(r.item.name, r.severity) }] : [],
  );

  // Prepare available items for sheets. Lifestyle shows all options (including
  // the current pick) so the user can switch; constraints/intolerances/goals
  // exclude what's already added.
  const availableLifestyle = LIFESTYLE_DIETS.map(d => ({
    id: d.value,
    label: t(d.labelKey),
  }));

  const existingConstraintValues = existingConstraintRows.flatMap(r =>
    r.diet ? [r.diet] : [],
  );
  const availableConstraints = CONSTRAINT_DIETS.filter(
    d => !existingConstraintValues.includes(d.value),
  ).map(d => ({ id: d.value, label: t(d.labelKey) }));

  const availableIntolerances = INTOLERANCE_OPTIONS.filter(
    i => !existingIntolerances.includes(i.value),
  ).map(i => ({
    id: i.value,
    label: t(i.labelKey),
  }));

  const availableGoals = HEALTH_GOAL_OPTIONS.filter(
    h => !existingHealthGoals.includes(h.value),
  ).map(h => ({
    id: h.value,
    label: t(h.labelKey),
  }));

  // Handle opening sheets
  const handleOpenDietSheet = () => {
    setSelectedDietIds(currentLifestyleDiets);
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

  const [isAvoidSheetVisible, setAvoidSheetVisible] = useState(false);

  const handleAvoidFood = async (
    food: { id: string },
    severity: RestrictionSeverity,
  ) => {
    const success = await onAdd([{ item: food.id }], severity);
    if (!success) {
      alertService.alert(t('labels.error'), t('dietaryProfile.addAvoidFailed'));
    }
    return success;
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
  // A tap replaces only the diet of its group it rules out: Vegan replaces
  // Vegetarian, Keto sits beside it.
  const handleSelectDiets = (next: Diet[]) => {
    const picked = next.find(diet => !selectedDietIds.includes(diet));
    setSelectedDietIds(picked ? withDietPicked(selectedDietIds, picked) : next);
  };

  const handleSaveDiet = () => {
    const added = selectedDietIds.filter(
      diet => !currentLifestyleDiets.includes(diet),
    );
    const removedIds = existingLifestyleRows.flatMap(r =>
      r.diet && !selectedDietIds.includes(r.diet) ? [r.id] : [],
    );
    if (added.length === 0 && removedIds.length === 0) {
      setDietSheetVisible(false);
      return;
    }

    void executeWriteWithFinally(
      async () => {
        const success = await onChangeDiets(added, removedIds);

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

    void executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionKindInput[] = selectedConstraintIds.map(
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

    void executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionKindInput[] = selectedIntoleranceIds.map(
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

    void executeWriteWithFinally(
      async () => {
        const restrictions: RestrictionKindInput[] = selectedGoalIds.map(
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
      {/* Diet Section: one animal-food diet and one eating style */}
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

      {/* Foods I Avoid Section: catalog foods, each covering its every kind */}
      <RestrictionSection
        title={t('dietaryProfile.avoidTitle')}
        existingItems={existingAvoidItems}
        onRemove={onRemove}
        onAddPress={() => setAvoidSheetVisible(true)}
        emptyMessage={t('dietaryProfile.avoidEmpty')}
      />

      <MultiSelectChipSheet
        visible={isDietSheetVisible}
        title={t('dietaryProfile.dietSheetTitle')}
        items={availableLifestyle}
        selectedItems={selectedDietIds}
        onSelect={handleSelectDiets}
        onClose={() => setDietSheetVisible(false)}
        onDone={handleSaveDiet}
        loading={isSavingDiets}
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

      <AvoidFoodSheet
        visible={isAvoidSheetVisible}
        onDismiss={() => setAvoidSheetVisible(false)}
        avoided={
          new Set(
            existingRestrictions.flatMap(r => (r.item ? [r.item.id] : [])),
          )
        }
        onPick={handleAvoidFood}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    marginBottom: 0,
  },
}));
