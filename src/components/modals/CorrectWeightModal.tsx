import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { useUnistyles } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#hooks/pantry/usePantryItemTransformation';

interface CorrectWeightModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (netWeight: number, reason: string, netWeightUnitId?: string) => void;
}

export const CorrectWeightModal: React.FC<CorrectWeightModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);
  const [weightInput, setWeightInput] = useState('');
  const [unitDisplay, setUnitDisplay] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      setWeightInput(pantryItem.netWeight?.toString() || '');
      setUnitDisplay(
        pantryItem.netWeightUnit?.symbol || pantryItem.netWeightUnit?.name || '',
      );
      setSelectedUnitId(pantryItem.netWeightUnit?.id || null);
      setReason('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  const handleUnitSelected = useCallback(
    (unitId: string | null, unitName: string | null) => {
      setSelectedUnitId(unitId);
      if (unitName) setUnitDisplay(unitName);
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const netWeight = parseFloat(weightInput);
    if (isNaN(netWeight) || netWeight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the correction');
      return;
    }

    onConfirm(
      netWeight,
      reason.trim(),
      selectedUnitId && selectedUnitId !== pantryItem.netWeightUnit?.id
        ? selectedUnitId
        : undefined,
    );
    onClose();
  }, [pantryItem, weightInput, reason, selectedUnitId, onConfirm, onClose]);

  const currentWeightText = formatNetWeightDisplay(
    pantryItem?.netWeight,
    pantryItem?.netWeightUnit,
  );
  const remainingWeightText = formatNetWeightDisplay(
    pantryItem?.remainingNetWeight,
    pantryItem?.netWeightUnit,
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['65%', '85%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
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
      <BottomSheetKeyboardAwareScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[
          commonStyles.bottomSheetContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <BottomSheetHeader
          title="Correct Weight"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Correct"
        />

        {pantryItem && (
          <>
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              {currentWeightText && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    Net Weight: {currentWeightText}
                  </Text>
                </View>
              )}
              {remainingWeightText && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    Remaining: {remainingWeightText}
                  </Text>
                </View>
              )}
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  Quantity:{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label="New Net Weight"
                required
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="e.g., 14.5"
                keyboardType="decimal-pad"
                useBottomSheetInput
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <UnitAutocompleteField
                variant="modal"
                label="Unit"
                value={unitDisplay}
                onChangeText={setUnitDisplay}
                onUnitSelected={handleUnitSelected}
                placeholder="oz, g, ml"
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label="Reason"
                required
                value={reason}
                onChangeText={setReason}
                placeholder="Why is the weight being corrected?"
                useBottomSheetInput
              />
            </View>
          </>
        )}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
