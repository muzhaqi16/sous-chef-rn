import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet } from 'react-native-unistyles';
import { ValueText } from '../atoms/ValueText';
import {
  getInputLabelForField,
  getPlaceholderForField,
} from '#utils/inputMapping';
import { getValidationSchemaForField } from '#/utils/validation/profile';
import { Icon } from '#/utils/iconUtils';
import { TextEditBottomSheet } from '#/components/modals/TextEditBottomSheet/TextEditBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Pressable } from 'react-native-gesture-handler';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';

export interface SettingRowProps {
  item: any;
  isFirst: boolean;
  isLast: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  item,
  isFirst,
  isLast,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [textEditVisible, setTextEditVisible] = useState(false);

  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      onDismiss: () => setModalVisible(false),
      snapPoints: [],
      enableDynamicSizing: true,
    });

  // Sync bottom sheet visibility with state (complex: checks item.type)
  useEffect(() => {
    if (item.type === 'modal') {
      if (modalVisible) {
        ref.current?.present();
      } else {
        ref.current?.dismiss();
      }
    }
  }, [modalVisible, item.type, ref]);

  // Get field metadata
  const inputLabel = getInputLabelForField(item.key);
  const placeholder = getPlaceholderForField(item.key);

  const handlePress = () => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.type === 'text') {
      setTextEditVisible(true);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const handleSwitchChange = () => {
    if (item.type !== 'switch') return;
    if (item.onPress) {
      item.onPress();
    }
  };

  const handleModalOptionPress = (optionValue: string) => () => {
    if (item.onSave) {
      item.onSave(optionValue);
    }
    setModalVisible(false);
  };

  const handleTextSave = (value: string) => {
    if (item.onSave) {
      item.onSave(value);
    }
  };

  const handleTextEditClose = () => {
    setTextEditVisible(false);
  };

  // Build accessibility label based on setting type
  const getAccessibilityLabel = () => {
    const baseLabel = item.label;
    if (item.type === 'switch') {
      return `${baseLabel}, ${item.value ? 'enabled' : 'disabled'}`;
    } else if (item.type === 'modal' && item.options) {
      const selectedOption =
        item.options?.find((opt: any) => opt.value === item.value)?.label ||
        'Select';
      return `${baseLabel}, currently ${selectedOption}`;
    } else if (item.type === 'text') {
      return `${baseLabel}, ${item.value || 'not set'}`;
    } else if (item.type === 'info') {
      return `${baseLabel}, ${item.value || 'not set'}`;
    }
    return baseLabel;
  };

  const getAccessibilityHint = () => {
    if (item.type === 'switch') {
      return `Tap to ${item.value ? 'disable' : 'enable'} ${item.label}`;
    } else if (item.type === 'modal') {
      return 'Tap to select an option';
    } else if (item.type === 'text') {
      return 'Tap to edit';
    } else if (item.type === 'navigation' || item.type === 'action') {
      return 'Tap to open';
    }
    return undefined;
  };

  return (
    <>
      <Pressable
        testID={item.testID || `profile-${item.key}-button`}
        onPress={item.type === 'info' ? undefined : handlePress}
        disabled={item.type === 'info'}
        android_ripple={item.type === 'info' ? null : RIPPLE.SUBTLE}
        style={({ pressed }) => [
          styles.rowWrapper,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
          pressed && styles.pressed,
        ]}
        accessibilityRole={item.type === 'info' ? 'text' : 'button'}
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getAccessibilityHint()}
        accessibilityState={{ disabled: item.disabled || item.type === 'info' }}
      >
        <View style={styles.row}>
          {item.icon}
          <Text size="md" style={styles.rowLabel}>
            {item.label}
          </Text>
          <View style={styles.rowSpacer} />

          {item.type === 'info' && (
            <ValueText>{item.value as string}</ValueText>
          )}

          {item.type === 'text' && (
            <>
              <ValueText>{item.value as string}</ValueText>
              <Icon name="pencil" size={16} tone="textSecondary" />
            </>
          )}

          {item.type === 'switch' && (
            <BaseSwitch
              testID={`profile-${item.key}-switch`}
              value={item.value as boolean}
              onValueChange={handleSwitchChange}
            />
          )}

          {item.type === 'radio' && !!item.options && (
            <Ionicons
              name={
                item.selected === item.value
                  ? 'radio-button-on'
                  : 'radio-button-off'
              }
              size={20}
              color={
                item.selected === item.value
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
          )}

          {item.type === 'modal' && (
            <View style={styles.modalValueContainer}>
              <Text
                size="md"
                tone="secondary"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.options?.find((opt: any) => opt.value === item.value)
                  ?.label || 'Select'}
              </Text>
              <Icon name="chevron-forward" size={20} tone="textSecondary" />
            </View>
          )}

          {item.type === 'action' && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}

          {item.type === 'navigation' && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}
        </View>
      </Pressable>

      {/* Text Edit Bottom Sheet */}
      <TextEditBottomSheet
        visible={textEditVisible}
        title={inputLabel}
        label={inputLabel}
        placeholder={placeholder}
        initialValue={item.value || ''}
        fieldKey={item.key}
        // @ts-expect-error - yup schema type compatibility
        validationSchema={getValidationSchemaForField(item.key)}
        onSave={handleTextSave}
        onClose={handleTextEditClose}
        multiline={item.key === 'bio'}
        keyboardType={item.key === 'phone' ? 'phone-pad' : 'default'}
      />

      {/* Selection Bottom Sheet */}
      {item.type === 'modal' && !!item.options && (
        <BottomSheetModal
          ref={ref}
          {...modalProps}
          handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        >
          <BottomSheetView style={[styles.sheetContent, contentContainerStyle]}>
            <Text
              size="lg"
              weight="semibold"
              align="center"
              style={styles.sheetTitle}
            >
              {item.label}
            </Text>
            <View style={styles.sheetDivider} />
            {item.options.map((opt: any) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && styles.pressed,
                ]}
                onPress={handleModalOptionPress(opt.value)}
                android_ripple={RIPPLE.SUBTLE}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityHint={`Select ${opt.label}`}
                accessibilityState={{ selected: item.value === opt.value }}
              >
                <Text size="md" style={styles.sheetOptionText}>
                  {opt.label}
                </Text>
                {item.value === opt.value && (
                  <Icon name="checkmark" size={20} tone="primary" />
                )}
              </Pressable>
            ))}
          </BottomSheetView>
        </BottomSheetModal>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowFirst: {
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
  },
  rowLast: {
    borderBottomLeftRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
    borderBottomWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: {
    marginLeft: theme.spacing.sm,
  },
  rowSpacer: { flex: 1 },
  modalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  sheetTitle: {
    paddingVertical: theme.spacing.sm,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginBottom: theme.spacing.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  sheetOptionText: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
