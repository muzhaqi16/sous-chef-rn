import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { BottomSheetModal } from '#hooks/ui/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/ui/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/atoms/FormInput';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { DIETARY_LIMITS } from '#domain/dietary';

interface CookingPreferencesSheetProps {
  visible: boolean;
  onClose: () => void;
  /** An emptied limit arrives as null, which clears it. */
  onSave: (values: { maxCookTimeMinutes?: number | null }) => Promise<boolean>;
  initialValues?: { maxCookTimeMinutes?: number | null };
}

/** The longest cooking time the user wants, which Recipes' search filters by. */
export const CookingPreferencesSheet: React.FC<
  CookingPreferencesSheetProps
> = ({ visible, onClose, onSave, initialValues }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['40%'],
  });

  const [cookTime, setCookTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (visible !== prevVisible || initialValues !== prevInitialValues) {
    setPrevVisible(visible);
    setPrevInitialValues(initialValues);
    if (visible) {
      setCookTime(initialValues?.maxCookTimeMinutes?.toString() ?? '');
    }
  }

  const handleSave = async () => {
    const updates: { maxCookTimeMinutes?: number | null } = {};
    if (cookTime) {
      const cookTimeValue = parseInt(cookTime);
      if (
        isNaN(cookTimeValue) ||
        cookTimeValue < DIETARY_LIMITS.cookTime.min ||
        cookTimeValue > DIETARY_LIMITS.cookTime.max
      ) {
        alertService.alert(
          t('labels.invalidInput'),
          t('cookingPreferences.cookTimeRange', {
            min: DIETARY_LIMITS.cookTime.min,
            max: DIETARY_LIMITS.cookTime.max,
          }),
        );
        return;
      }
      updates.maxCookTimeMinutes = cookTimeValue;
    } else if (initialValues?.maxCookTimeMinutes != null) {
      // Left blank sends nothing; emptied from a stored limit, it clears it.
      updates.maxCookTimeMinutes = null;
    }

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      alertService.alert(
        t('labels.error'),
        t('cookingPreferences.updateFailed'),
      );
    }
  };

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          contentPadding="md"
          title={t('labels.cookingPreferences')}
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={t('labels.save')}
          confirmDisabled={saving}
        />

        <View style={styles.section}>
          <FormInput
            label={t('cookingPreferences.maxCookTime')}
            value={cookTime}
            onChangeText={setCookTime}
            keyboardType="number-pad"
            placeholder={t('cookingPreferences.cookTimePlaceholder')}
            useBottomSheetInput
          />
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
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
