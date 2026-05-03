import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { Icon } from '#utils/iconUtils';
import { type MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

interface DuplicatePlanSheetProps {
  visible: boolean;
  mealPlan: MealPlanDisplayFragment | null;
  onClose: () => void;
  onDuplicate: (input: {
    mealPlanId: string;
    newName: string;
    newStartDate: string;
    newEndDate: string;
  }) => void;
  loading: boolean;
}

export const DuplicatePlanSheet: React.FC<DuplicatePlanSheetProps> = ({
  visible,
  mealPlan,
  onClose,
  onDuplicate,
  loading,
}) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['55%'],
    keyboardAware: true,
  });

  const [name, setName] = useState('');
  const [startDateOffset, setStartDateOffset] = useState(0);

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevMealPlan, setPrevMealPlan] = useState(mealPlan);
  if (visible !== prevVisible || mealPlan !== prevMealPlan) {
    setPrevVisible(visible);
    setPrevMealPlan(mealPlan);
    if (visible && mealPlan) {
      setName(`${mealPlan.name} (Copy)`);
      setStartDateOffset(0);
    }
  }

  const duration = (() => {
    if (!mealPlan?.startDate || !mealPlan?.endDate) return 7;
    return differenceInDays(
      parseISO(mealPlan.endDate),
      parseISO(mealPlan.startDate),
    );
  })();

  const newStartDate = (() => {
    if (!mealPlan?.endDate) return new Date();
    return addDays(parseISO(mealPlan.endDate), 1 + startDateOffset);
  })();

  const newEndDate = (() => {
    return addDays(newStartDate, duration);
  })();

  const handleDuplicate = () => {
    if (!mealPlan || !name.trim()) return;
    onDuplicate({
      mealPlanId: mealPlan.id,
      newName: name.trim(),
      newStartDate: newStartDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
    });
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title="Duplicate Plan"
          onCancel={onClose}
          onConfirm={handleDuplicate}
          confirmLabel={loading ? 'Duplicating...' : 'Duplicate'}
          confirmDisabled={loading || !name.trim()}
          confirmColor="primary"
        />

        {!!mealPlan && (
          <View style={styles.currentInfo}>
            <Text size="sm" tone="secondary" style={styles.currentLabel}>
              Current Plan
            </Text>
            <Text size="md" weight="medium">
              {format(parseISO(mealPlan.startDate), 'MMM d')} -{' '}
              {format(parseISO(mealPlan.endDate), 'MMM d, yyyy')}
            </Text>
          </View>
        )}

        <FormInput
          label="New Plan Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter plan name"
          required
        />

        {/* Date adjustment */}
        <View style={styles.section}>
          <Text size="sm" weight="medium" tone="secondary">
            Start Date
          </Text>
          <View style={styles.dateAdjust}>
            <Pressable
              onPress={() => setStartDateOffset(prev => prev - 7)}
              style={styles.dateButton}
              hitSlop={8}
            >
              <Icon
                name="chevron-back"
                size={20}
                color={styles.dateButtonIcon.color}
              />
            </Pressable>
            <View style={styles.dateDisplay}>
              <Text size="md" weight="semibold">
                {format(newStartDate, 'EEE, MMM d')}
              </Text>
              <Text size="sm" tone="secondary" style={styles.dateSubtext}>
                to {format(newEndDate, 'EEE, MMM d')}
              </Text>
            </View>
            <Pressable
              onPress={() => setStartDateOffset(prev => prev + 7)}
              style={styles.dateButton}
              hitSlop={8}
            >
              <Icon
                name="chevron-forward"
                size={20}
                color={styles.dateButtonIcon.color}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Icon
            name="information-circle-outline"
            size={18}
            color={styles.infoText.color}
          />
          <Text size="sm" style={styles.infoText}>
            All meals will be copied to the new date range with the same
            structure.
          </Text>
        </View>
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  currentInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  currentLabel: {
    marginBottom: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  dateAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
  },
  dateButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
  },
  dateButtonIcon: {
    color: theme.colors.primary,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  dateSubtext: {
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
  },
  infoText: {
    flex: 1,
    color: theme.colors.textSecondary,
  },
}));
