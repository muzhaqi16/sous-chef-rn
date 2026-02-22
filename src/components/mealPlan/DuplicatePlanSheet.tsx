import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { FormInput } from '#components/molecules/FormInput';
import { Icon } from '#utils/iconUtils';
import type { MealPlanDisplayFragment } from '#generated';

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
    keyboardBehavior: 'interactive',
  });

  const [name, setName] = useState('');
  const [startDateOffset, setStartDateOffset] = useState(0);

  const duration = useMemo(() => {
    if (!mealPlan?.startDate || !mealPlan?.endDate) return 7;
    return differenceInDays(parseISO(mealPlan.endDate), parseISO(mealPlan.startDate));
  }, [mealPlan?.startDate, mealPlan?.endDate]);

  const newStartDate = useMemo(() => {
    if (!mealPlan?.endDate) return new Date();
    return addDays(parseISO(mealPlan.endDate), 1 + startDateOffset);
  }, [mealPlan?.endDate, startDateOffset]);

  const newEndDate = useMemo(() => {
    return addDays(newStartDate, duration);
  }, [newStartDate, duration]);

  useEffect(() => {
    if (visible && mealPlan) {
      setName(`${mealPlan.name} (Copy)`);
      setStartDateOffset(0);
    }
  }, [visible, mealPlan]);

  const handleDuplicate = useCallback(() => {
    if (!mealPlan || !name.trim()) return;
    onDuplicate({
      mealPlanId: mealPlan.id,
      newName: name.trim(),
      newStartDate: newStartDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
    });
  }, [mealPlan, name, newStartDate, newEndDate, onDuplicate]);

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
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
            <Text style={styles.currentLabel}>Current Plan</Text>
            <Text style={styles.currentValue}>
              {format(parseISO(mealPlan.startDate), 'MMM d')} - {format(parseISO(mealPlan.endDate), 'MMM d, yyyy')}
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
          <Text style={styles.label}>Start Date</Text>
          <View style={styles.dateAdjust}>
            <Pressable
              onPress={() => setStartDateOffset(prev => prev - 7)}
              style={styles.dateButton}
              hitSlop={8}
            >
              <Icon name="chevron-back" size={20} color={styles.dateButtonIcon.color} />
            </Pressable>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>
                {format(newStartDate, 'EEE, MMM d')}
              </Text>
              <Text style={styles.dateSubtext}>
                to {format(newEndDate, 'EEE, MMM d')}
              </Text>
            </View>
            <Pressable
              onPress={() => setStartDateOffset(prev => prev + 7)}
              style={styles.dateButton}
              hitSlop={8}
            >
              <Icon name="chevron-forward" size={20} color={styles.dateButtonIcon.color} />
            </Pressable>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Icon name="information-circle-outline" size={18} color={styles.infoText.color} />
          <Text style={styles.infoText}>
            All meals will be copied to the new date range with the same structure.
          </Text>
        </View>
      </BottomSheetScrollView>
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  section: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
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
  dateText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  dateSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
