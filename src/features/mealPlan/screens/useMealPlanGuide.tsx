import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  SpotlightCoachMark,
  type TargetRect,
} from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTabBarState } from '#/context/TabBarActionsContext';
import { GUIDE_TOURS } from '#domain/guides';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { useTutorialSession } from '#hooks/ui/tutorialSession';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';

interface UseMealPlanGuideOptions {
  noPlans: boolean;
  canEdit: boolean;
  /** A sheet over the screen holds the guide until it closes. */
  paused: boolean;
  onCreatePlan: () => void;
  onAddMeal: () => void;
}

/**
 * "Plan a meal", started from Today's Getting started card: with no plan it
 * starts one; with a plan, it puts a meal on a day.
 */
export function useMealPlanGuide({
  noPlans,
  canEdit,
  paused,
  onCreatePlan,
  onAddMeal,
}: UseMealPlanGuideOptions) {
  const { t } = useTranslation();
  const started = useTutorialSession().startedGuides.has(GUIDE_TOURS.plan);
  const { addButtonRect, isOverlayOpen } = useTabBarState();
  const isFocused = useIsScreenFocused();
  const [createRect, setCreateRect] = useState<TargetRect | null>(null);
  const { ref, measure } = useMeasuredRect(started ? setCreateRect : undefined);
  const guide = useTutorialSequence({
    tourId: GUIDE_TOURS.plan,
    steps: [
      {
        featureId: 'plan_guide_create',
        title: t('mealPlan.guideCreateTitle'),
        subtitle: t('mealPlan.guideCreateSubtitle'),
        rectKey: 'createButton',
        when: () => noPlans,
      },
      {
        featureId: 'plan_guide_add',
        title: t('mealTemplateBuilder.addMeal'),
        subtitle: t('mealPlan.guideAddSubtitle'),
        rectKey: 'addButton',
        when: () => !noPlans && canEdit,
      },
    ],
    targetRects: { createButton: createRect, addButton: addButtonRect },
    canStart: started,
    isPaused: !isFocused || isOverlayOpen || paused,
  });
  const step = guide.currentStep;

  return {
    /** Where the empty state's create button reports its place. */
    createRef: ref,
    measureCreate: measure,
    mark: step ? (
      <SpotlightCoachMark
        targetRect={step.targetRect}
        title={step.title}
        subtitle={step.subtitle}
        stepIndex={step.stepIndex}
        totalSteps={step.totalSteps}
        onDismiss={guide.skipAll}
        onClose={guide.pause}
        onNext={guide.advanceInPlace}
        onTargetPress={() => {
          if (step.featureId === 'plan_guide_create') onCreatePlan();
          else onAddMeal();
          guide.advance();
        }}
      />
    ) : null,
  };
}
