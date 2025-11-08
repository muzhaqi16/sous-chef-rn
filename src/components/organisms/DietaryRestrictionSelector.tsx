import React, { useState, useMemo } from 'react';
import { View, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CollapsibleMultiSelectSection } from '#/components/molecules/CollapsibleMultiSelectSection';
import { Diet, Intolerance, HealthGoal, RestrictionSeverity } from '#generated';
import { useSelectableItems } from '#/hooks/useSelectableItems';

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
};

export const DietaryRestrictionSelector: React.FC<
  DietaryRestrictionSelectorProps
> = ({ existingRestrictions, onAdd, onRemove }) => {
  // Expand/collapse state for each section
  const [isDietsExpanded, setIsDietsExpanded] = useState(false);
  const [isIntolerancesExpanded, setIsIntolerancesExpanded] = useState(false);
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);

  // Saving state for each section
  const [isSavingDiets, setIsSavingDiets] = useState(false);
  const [isSavingIntolerances, setIsSavingIntolerances] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);

  // Memoize existing restrictions to prevent infinite loops
  const existingDiets = useMemo(
    () => existingRestrictions.map((r) => r.diet).filter(Boolean),
    [existingRestrictions],
  );
  const existingIntolerances = useMemo(
    () => existingRestrictions.map((r) => r.intolerance).filter(Boolean),
    [existingRestrictions],
  );
  const existingHealthGoals = useMemo(
    () => existingRestrictions.map((r) => r.healthGoal).filter(Boolean),
    [existingRestrictions],
  );

  // Map existing restrictions to display items
  const existingDietItems = useMemo(
    () =>
      existingRestrictions
        .filter((r) => r.diet)
        .map((r) => ({
          id: r.id,
          label: DIETS.find((d) => d.value === r.diet)?.label || r.diet!,
        })),
    [existingRestrictions],
  );

  const existingIntoleranceItems = useMemo(
    () =>
      existingRestrictions
        .filter((r) => r.intolerance)
        .map((r) => ({
          id: r.id,
          label:
            INTOLERANCES.find((i) => i.value === r.intolerance)?.label ||
            r.intolerance!,
        })),
    [existingRestrictions],
  );

  const existingGoalItems = useMemo(
    () =>
      existingRestrictions
        .filter((r) => r.healthGoal)
        .map((r) => ({
          id: r.id,
          label:
            HEALTH_GOALS.find((h) => h.value === r.healthGoal)?.label ||
            r.healthGoal!,
        })),
    [existingRestrictions],
  );

  // Prepare selectable items
  const availableDiets = useMemo(
    () =>
      DIETS.filter((d) => !existingDiets.includes(d.value)).map((d) => ({
        id: d.value,
        label: d.label,
        value: d.value,
        selected: false,
      })),
    [existingDiets],
  );

  const availableIntolerances = useMemo(
    () =>
      INTOLERANCES.filter((i) => !existingIntolerances.includes(i.value)).map(
        (i) => ({
          id: i.value,
          label: i.label,
          value: i.value,
          selected: false,
        }),
      ),
    [existingIntolerances],
  );

  const availableGoals = useMemo(
    () =>
      HEALTH_GOALS.filter((h) => !existingHealthGoals.includes(h.value)).map(
        (h) => ({
          id: h.value,
          label: h.label,
          value: h.value,
          selected: false,
        }),
      ),
    [existingHealthGoals],
  );

  // Use selectableItems hook for each section
  const {
    items: dietItems,
    selectedItems: selectedDiets,
    toggleItem: toggleDiet,
    isMaxReached: isDietsMaxReached,
    clearSelection: clearDietsSelection,
  } = useSelectableItems({
    initialItems: availableDiets,
    maxSelection: 50,
  });

  const {
    items: intoleranceItems,
    selectedItems: selectedIntolerances,
    toggleItem: toggleIntolerance,
    isMaxReached: isIntolerancesMaxReached,
    clearSelection: clearIntolerancesSelection,
  } = useSelectableItems({
    initialItems: availableIntolerances,
    maxSelection: 50,
  });

  const {
    items: goalItems,
    selectedItems: selectedGoals,
    toggleItem: toggleGoal,
    isMaxReached: isGoalsMaxReached,
    clearSelection: clearGoalsSelection,
  } = useSelectableItems({
    initialItems: availableGoals,
    maxSelection: 50,
  });

  // Save handlers for each section
  const handleSaveDiets = async () => {
    setIsSavingDiets(true);
    try {
      const restrictions: RestrictionType[] = selectedDiets.map((item) => ({
        diet: item.value as Diet,
      }));

      const success = await onAdd(
        restrictions,
        RestrictionSeverity.Preference,
      );

      if (success) {
        clearDietsSelection();
      } else {
        Alert.alert('Error', 'Failed to add diets');
      }
    } finally {
      setIsSavingDiets(false);
    }
  };

  const handleSaveIntolerances = async () => {
    setIsSavingIntolerances(true);
    try {
      const restrictions: RestrictionType[] = selectedIntolerances.map(
        (item) => ({
          intolerance: item.value as Intolerance,
        }),
      );

      const success = await onAdd(
        restrictions,
        RestrictionSeverity.Intolerance,
      );

      if (success) {
        clearIntolerancesSelection();
      } else {
        Alert.alert('Error', 'Failed to add intolerances');
      }
    } finally {
      setIsSavingIntolerances(false);
    }
  };

  const handleSaveGoals = async () => {
    setIsSavingGoals(true);
    try {
      const restrictions: RestrictionType[] = selectedGoals.map((item) => ({
        healthGoal: item.value as HealthGoal,
      }));

      const success = await onAdd(restrictions, RestrictionSeverity.Goal);

      if (success) {
        clearGoalsSelection();
      } else {
        Alert.alert('Error', 'Failed to add health goals');
      }
    } finally {
      setIsSavingGoals(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Diets Section */}
      <CollapsibleMultiSelectSection
        title="Diet"
        items={dietItems}
        selectedItems={selectedDiets}
        existingItems={existingDietItems}
        onToggleItem={toggleDiet}
        isExpanded={isDietsExpanded}
        onToggleExpand={() => setIsDietsExpanded(!isDietsExpanded)}
        onSave={handleSaveDiets}
        onRemove={onRemove}
        isMaxReached={isDietsMaxReached}
        isSaving={isSavingDiets}
        emptyMessage="All diets have been added"
      />

      {/* Intolerances Section */}
      <CollapsibleMultiSelectSection
        title="Intolerance"
        items={intoleranceItems}
        selectedItems={selectedIntolerances}
        existingItems={existingIntoleranceItems}
        onToggleItem={toggleIntolerance}
        isExpanded={isIntolerancesExpanded}
        onToggleExpand={() =>
          setIsIntolerancesExpanded(!isIntolerancesExpanded)
        }
        onSave={handleSaveIntolerances}
        onRemove={onRemove}
        isMaxReached={isIntolerancesMaxReached}
        isSaving={isSavingIntolerances}
        emptyMessage="All intolerances have been added"
      />

      {/* Health Goals Section */}
      <CollapsibleMultiSelectSection
        title="Health Goal"
        items={goalItems}
        selectedItems={selectedGoals}
        existingItems={existingGoalItems}
        onToggleItem={toggleGoal}
        isExpanded={isGoalsExpanded}
        onToggleExpand={() => setIsGoalsExpanded(!isGoalsExpanded)}
        onSave={handleSaveGoals}
        onRemove={onRemove}
        isMaxReached={isGoalsMaxReached}
        isSaving={isSavingGoals}
        emptyMessage="All health goals have been added"
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    marginBottom: 0,
  },
}));
