import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { RestrictionSection } from '#features/profile/components/RestrictionSection/RestrictionSection';
import { MultiSelectChipSheet } from '#components/organisms/MultiSelectChipSheet/MultiSelectChipSheet';
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
} from '#domain/dietary';
import { executeWriteWithFinally } from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';

// Mutually-exclusive lifestyle diets (single-select) vs stackable constraints
// (multi-select), derived from the shared classification.
const LIFESTYLE_DIETS = DIET_OPTIONS.filter(d => isLifestyleDiet(d.value));
const CONSTRAINT_DIETS = DIET_OPTIONS.filter(d => !isLifestyleDiet(d.value));

type DietaryRestrictionSelectorProps = {
  existingRestrictions: {
    id: string;
    diet?: Diet | null;
    intolerance?: Intolerance | null;
    healthGoal?: HealthGoal | null;
  }[];
  onAdd: (
    restrictions: RestrictionKindInput[],
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

  const existingIntoleranceItems = existingRestrictions.flatMap(r =>
    r.intolerance ? [{ id: r.id, label: t(restrictionLabelKey(r)) }] : [],
  );

  const existingGoalItems = existingRestrictions.flatMap(r =>
    r.healthGoal ? [{ id: r.id, label: t(restrictionLabelKey(r)) }] : [],
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

    void executeWriteWithFinally(
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
