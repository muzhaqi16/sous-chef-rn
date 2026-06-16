import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { RestrictionSection } from '#/components/molecules/RestrictionSection/RestrictionSection';
import { MultiSelectChipSheet } from '#/components/molecules/MultiSelectChipSheet/MultiSelectChipSheet';
import {
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { isLifestyleDiet } from '#/constants/dietary';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';

// Lifestyle dietary choices
const DIETS: { label: string; value: Diet }[] = [
  { label: 'Vegetarian', value: Diet.Vegetarian },
  { label: 'Vegan', value: Diet.Vegan },
  { label: 'Gluten Free', value: Diet.GlutenFree },
  { label: 'Keto', value: Diet.Keto },
  { label: 'Paleo', value: Diet.Paleo },
  { label: 'Pescetarian', value: Diet.Pescetarian },
  { label: 'Lacto Vegetarian', value: Diet.LactoVegetarian },
  { label: 'Ovo Vegetarian', value: Diet.OvoVegetarian },
  { label: 'Primal', value: Diet.Primal },
  { label: 'Low FODMAP', value: Diet.LowFodmap },
  { label: 'Whole30', value: Diet.Whole30 },
];

// Mutually-exclusive lifestyle diets (single-select) vs stackable constraints
// (multi-select), derived from the shared classification.
const LIFESTYLE_DIETS = DIETS.filter(d => isLifestyleDiet(d.value));
const CONSTRAINT_DIETS = DIETS.filter(d => !isLifestyleDiet(d.value));

// Allergies and intolerances
const INTOLERANCES: { label: string; value: Intolerance }[] = [
  { label: 'Dairy', value: Intolerance.Dairy },
  { label: 'Egg', value: Intolerance.Egg },
  { label: 'Gluten', value: Intolerance.Gluten },
  { label: 'Grain', value: Intolerance.Grain },
  { label: 'Peanut', value: Intolerance.Peanut },
  { label: 'Seafood', value: Intolerance.Seafood },
  { label: 'Sesame', value: Intolerance.Sesame },
  { label: 'Shellfish', value: Intolerance.Shellfish },
  { label: 'Soy', value: Intolerance.Soy },
  { label: 'Sulfite', value: Intolerance.Sulfite },
  { label: 'Tree Nut', value: Intolerance.TreeNut },
  { label: 'Wheat', value: Intolerance.Wheat },
  { label: 'Fish', value: Intolerance.Fish },
];

// Nutritional objectives
const HEALTH_GOALS: { label: string; value: HealthGoal }[] = [
  { label: 'Low Carb', value: HealthGoal.LowCarb },
  { label: 'High Protein', value: HealthGoal.HighProtein },
  { label: 'Low Sodium', value: HealthGoal.LowSodium },
  { label: 'Sugar Free', value: HealthGoal.SugarFree },
  { label: 'Diabetic Friendly', value: HealthGoal.DiabeticFriendly },
  { label: 'Heart Healthy', value: HealthGoal.HeartHealthy },
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

  // Map existing restrictions to display items
  const existingLifestyleItems = existingLifestyleRows.map(r => ({
    id: r.id,
    label: DIETS.find(d => d.value === r.diet)?.label || r.diet!,
  }));

  const existingConstraintItems = existingConstraintRows.map(r => ({
    id: r.id,
    label: DIETS.find(d => d.value === r.diet)?.label || r.diet!,
  }));

  const existingIntoleranceItems = existingRestrictions
    .filter(r => r.intolerance)
    .map(r => ({
      id: r.id,
      label:
        INTOLERANCES.find(i => i.value === r.intolerance)?.label ||
        r.intolerance!,
    }));

  const existingGoalItems = existingRestrictions
    .filter(r => r.healthGoal)
    .map(r => ({
      id: r.id,
      label:
        HEALTH_GOALS.find(h => h.value === r.healthGoal)?.label ||
        r.healthGoal!,
    }));

  // Prepare available items for sheets. Lifestyle shows all options (including
  // the current pick) so the user can switch; constraints/intolerances/goals
  // exclude what's already added.
  const availableLifestyle = LIFESTYLE_DIETS.map(d => ({
    id: d.value,
    label: d.label,
  }));

  const existingConstraintValues = existingConstraintRows
    .map(r => r.diet)
    .filter(Boolean) as Diet[];
  const availableConstraints = CONSTRAINT_DIETS.filter(
    d => !existingConstraintValues.includes(d.value),
  ).map(d => ({ id: d.value, label: d.label }));

  const availableIntolerances = INTOLERANCES.filter(
    i => !existingIntolerances.includes(i.value),
  ).map(i => ({
    id: i.value,
    label: i.label,
  }));

  const availableGoals = HEALTH_GOALS.filter(
    h => !existingHealthGoals.includes(h.value),
  ).map(h => ({
    id: h.value,
    label: h.label,
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

  // Save handlers
  const handleSaveDiet = () => {
    const selected = selectedDietIds[0];
    // No change (nothing picked, or re-picked the current diet) — just close.
    if (!selected || selected === currentLifestyleDiet) {
      setDietSheetVisible(false);
      return;
    }

    executeRefreshWithFinally(async () => {
      const replaceIds = existingLifestyleRows.map(r => r.id);
      const success = await onSelectLifestyleDiet(selected, replaceIds);

      if (success) {
        setSelectedDietIds([]);
        setDietSheetVisible(false);
      } else {
        alertService.alert('Error', 'Failed to update diet');
      }
    }, setIsSavingDiets);
  };

  const handleSaveConstraints = () => {
    if (selectedConstraintIds.length === 0) {
      setConstraintSheetVisible(false);
      return;
    }

    executeRefreshWithFinally(async () => {
      const restrictions: RestrictionType[] = selectedConstraintIds.map(
        diet => ({ diet }),
      );

      const success = await onAdd(restrictions, RestrictionSeverity.Preference);

      if (success) {
        setSelectedConstraintIds([]);
        setConstraintSheetVisible(false);
      } else {
        alertService.alert('Error', 'Failed to add dietary constraints');
      }
    }, setIsSavingConstraints);
  };

  const handleSaveIntolerances = () => {
    if (selectedIntoleranceIds.length === 0) {
      setIntoleranceSheetVisible(false);
      return;
    }

    executeRefreshWithFinally(async () => {
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
        alertService.alert('Error', 'Failed to add intolerances');
      }
    }, setIsSavingIntolerances);
  };

  const handleSaveGoals = () => {
    if (selectedGoalIds.length === 0) {
      setGoalSheetVisible(false);
      return;
    }

    executeRefreshWithFinally(async () => {
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
        alertService.alert('Error', 'Failed to add health goals');
      }
    }, setIsSavingGoals);
  };

  return (
    <View style={styles.container}>
      {/* Diet Section (single lifestyle diet) */}
      <RestrictionSection
        title="Diet"
        existingItems={existingLifestyleItems}
        onRemove={onRemove}
        onAddPress={handleOpenDietSheet}
        emptyMessage="No diet selected yet"
      />

      {/* Dietary Constraints Section (stackable) */}
      <RestrictionSection
        title="Dietary Constraints"
        existingItems={existingConstraintItems}
        onRemove={onRemove}
        onAddPress={handleOpenConstraintSheet}
        emptyMessage="No constraints added yet"
      />

      {/* Intolerances Section */}
      <RestrictionSection
        title="Allergies & Intolerances"
        existingItems={existingIntoleranceItems}
        onRemove={onRemove}
        onAddPress={handleOpenIntoleranceSheet}
        emptyMessage="No allergies added yet"
      />

      {/* Health Goals Section */}
      <RestrictionSection
        title="Health Goals"
        existingItems={existingGoalItems}
        onRemove={onRemove}
        onAddPress={handleOpenGoalSheet}
        emptyMessage="No health goals added yet"
      />

      {/* Diet Selection Sheet (single-select) */}
      <MultiSelectChipSheet
        visible={isDietSheetVisible}
        title="Select Diet"
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
        title="Select Dietary Constraints"
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
        title="Select Allergies & Intolerances"
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
        title="Select Health Goals"
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
