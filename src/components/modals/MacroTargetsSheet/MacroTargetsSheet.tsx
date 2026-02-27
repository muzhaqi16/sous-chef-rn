import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { DIETARY_LIMITS } from '#/constants/dietary';

interface MacroTargetsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (values: {
    calorieTarget?: number;
    proteinTarget?: number;
    carbsTarget?: number;
    fatTarget?: number;
  }) => Promise<boolean>;
  initialValues?: {
    calorieTarget?: number | null;
    proteinTarget?: number | null;
    carbsTarget?: number | null;
    fatTarget?: number | null;
  };
}

export const MacroTargetsSheet: React.FC<MacroTargetsSheetProps> = ({
  visible,
  onClose,
  onSave,
  initialValues }) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Form state
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (visible !== prevVisible || initialValues !== prevInitialValues) {
    setPrevVisible(visible);
    setPrevInitialValues(initialValues);
    if (visible) {
      setCalories(initialValues?.calorieTarget?.toString() || '');
      setProtein(initialValues?.proteinTarget?.toString() || '');
      setCarbs(initialValues?.carbsTarget?.toString() || '');
      setFat(initialValues?.fatTarget?.toString() || '');
    }
  }

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSave = async () => {
    const updates: {
      calorieTarget?: number;
      proteinTarget?: number;
      carbsTarget?: number;
      fatTarget?: number;
    } = {};

    // Validate and add calories if provided
    if (calories) {
      const caloriesValue = parseInt(calories);
      if (
        isNaN(caloriesValue) ||
        caloriesValue < DIETARY_LIMITS.calories.min ||
        caloriesValue > DIETARY_LIMITS.calories.max
      ) {
        Alert.alert(
          'Invalid Input',
          `Calories must be between ${DIETARY_LIMITS.calories.min} and ${DIETARY_LIMITS.calories.max}`,
        );
        return;
      }
      updates.calorieTarget = caloriesValue;
    }

    // Validate and add protein if provided
    if (protein) {
      const proteinValue = parseInt(protein);
      if (
        isNaN(proteinValue) ||
        proteinValue < DIETARY_LIMITS.protein.min ||
        proteinValue > DIETARY_LIMITS.protein.max
      ) {
        Alert.alert(
          'Invalid Input',
          `Protein must be between ${DIETARY_LIMITS.protein.min}g and ${DIETARY_LIMITS.protein.max}g`,
        );
        return;
      }
      updates.proteinTarget = proteinValue;
    }

    // Validate and add carbs if provided
    if (carbs) {
      const carbsValue = parseInt(carbs);
      if (
        isNaN(carbsValue) ||
        carbsValue < DIETARY_LIMITS.carbs.min ||
        carbsValue > DIETARY_LIMITS.carbs.max
      ) {
        Alert.alert(
          'Invalid Input',
          `Carbs must be between ${DIETARY_LIMITS.carbs.min}g and ${DIETARY_LIMITS.carbs.max}g`,
        );
        return;
      }
      updates.carbsTarget = carbsValue;
    }

    // Validate and add fat if provided
    if (fat) {
      const fatValue = parseInt(fat);
      if (
        isNaN(fatValue) ||
        fatValue < DIETARY_LIMITS.fat.min ||
        fatValue > DIETARY_LIMITS.fat.max
      ) {
        Alert.alert(
          'Invalid Input',
          `Fat must be between ${DIETARY_LIMITS.fat.min}g and ${DIETARY_LIMITS.fat.max}g`,
        );
        return;
      }
      updates.fatTarget = fatValue;
    }

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      Alert.alert('Error', 'Failed to update macro targets');
    }
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['65%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <BottomSheetHeader
          title="Macro Targets"
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel="Save"
          confirmDisabled={saving}
        />

        {/* Description */}
        <Text style={styles.description}>
          Set your daily nutrition goals (optional)
        </Text>

        {/* Daily Calories */}
        <View style={styles.section}>
          <FormInput
            label="Daily Calories (kcal)"
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            placeholder="e.g., 2000"
            useBottomSheetInput
          />
        </View>

        {/* Protein */}
        <View style={styles.section}>
          <FormInput
            label="Protein (g)"
            value={protein}
            onChangeText={setProtein}
            keyboardType="number-pad"
            placeholder="e.g., 150"
            useBottomSheetInput
          />
        </View>

        {/* Carbs */}
        <View style={styles.section}>
          <FormInput
            label="Carbs (g)"
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="number-pad"
            placeholder="e.g., 200"
            useBottomSheetInput
          />
        </View>

        {/* Fat */}
        <View style={styles.section}>
          <FormInput
            label="Fat (g)"
            value={fat}
            onChangeText={setFat}
            keyboardType="number-pad"
            placeholder="e.g., 70"
            useBottomSheetInput
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1 },
  contentContainer: {
    padding: theme.spacing.md },
  description: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg },
  section: {
    marginBottom: theme.spacing.lg } }));
