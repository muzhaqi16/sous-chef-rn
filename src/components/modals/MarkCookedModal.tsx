import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Switch } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { parseFractionalInput } from '#/utils/fractionUtils';

interface MarkCookedModalProps {
  visible: boolean;
  recipeName: string;
  defaultServings: number;
  onClose: () => void;
  onConfirm: (input: {
    servings: number;
    deductFromPantry: boolean;
    notes?: string;
  }) => void;
}

export const MarkCookedModal: React.FC<MarkCookedModalProps> = ({
  visible,
  recipeName,
  defaultServings,
  onClose,
  onConfirm,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Form state
  const [servingsInput, setServingsInput] = useState('');
  const [deductFromPantry, setDeductFromPantry] = useState(true);
  const [notes, setNotes] = useState('');

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens
      setServingsInput(defaultServings?.toString() || '1');
      setDeductFromPantry(true);
      setNotes('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, defaultServings]);

  const handleConfirm = useCallback(() => {
    const servingsValue = parseFractionalInput(servingsInput);
    const finalServings = servingsValue && !isNaN(servingsValue) && servingsValue > 0
      ? servingsValue
      : defaultServings || 1;

    onConfirm({
      servings: finalServings,
      deductFromPantry,
      notes: notes || undefined,
    });
    onClose();
  }, [servingsInput, deductFromPantry, notes, defaultServings, onConfirm, onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['55%']}
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
          title="I Cooked This!"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Mark Cooked"
          confirmColor="success"
        />

        {/* Recipe Info */}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName}>{recipeName}</Text>
        </View>

        {/* Servings Input */}
        <View style={styles.section}>
          <FractionInput
            label="Servings Made"
            value={servingsInput}
            onChangeText={setServingsInput}
            placeholder={`e.g., ${defaultServings || 1}`}
            keyboardType="numeric"
          />
        </View>

        {/* Deduct from Pantry Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Deduct from Pantry</Text>
            <Text style={styles.toggleDescription}>
              Automatically reduce ingredient quantities in your pantry
            </Text>
          </View>
          <Switch
            value={deductFromPantry}
            onValueChange={setDeductFromPantry}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.white}
          />
        </View>

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <FormInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it turn out?"
            multiline
            numberOfLines={2}
          />
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
  },
  recipeInfo: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  recipeName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleLabel: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
