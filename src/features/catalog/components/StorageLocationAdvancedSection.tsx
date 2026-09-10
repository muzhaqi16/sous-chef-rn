import React, { useState, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormNumberInput } from '#features/catalog/components/FormNumberInput';
import { FormSelect } from '#components/molecules/FormSelect';
import { Icon } from '#utils/iconUtils';

import { Text } from '#components/atoms/Text';
import { buildCapacityUnitOptions } from '#features/catalog/components/storageLocationFormConfig';
import { motion } from '#/theme/foundations/motion';

interface StorageLocationAdvancedSectionProps {
  isClimateControlled: boolean;
  capacity: string;
  capacityUnit: string;
  isDefault: boolean;
  onToggleClimateControlled: () => void;
  onCapacityChange: (capacity: string) => void;
  onCapacityUnitChange: (capacityUnit: string) => void;
  onToggleDefault: () => void;
}

/**
 * Collapsible "Advanced settings" block for {@link StorageLocationForm}:
 * climate-control flag, capacity + unit, and the default toggle. Owns its own
 * expand/collapse state and chevron animation.
 */
export const StorageLocationAdvancedSection: React.FC<
  StorageLocationAdvancedSectionProps
> = ({
  isClimateControlled,
  capacity,
  capacityUnit,
  isDefault,
  onToggleClimateControlled,
  onCapacityChange,
  onCapacityUnitChange,
  onToggleDefault,
}) => {
  const { t } = useTranslation();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const chevronRotation = useSharedValue(0);

  useLayoutEffect(() => {
    chevronRotation.set(
      withSpring(advancedExpanded ? 180 : 0, motion.spring.EXPAND),
    );
  }, [advancedExpanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  return (
    <>
      <AppPressable
        style={styles.advancedHeader}
        onPress={() => setAdvancedExpanded(!advancedExpanded)}
      >
        <Text role="label" tone="secondary">
          {t('storageLocationForm.advancedSettings')}
        </Text>
        <Animated.View style={animatedChevronStyle}>
          <Icon name="chevron-down" size={20} tone="textSecondary" />
        </Animated.View>
      </AppPressable>
      {advancedExpanded ? (
        <Animated.View
          entering={FadeIn.duration(motion.timing.STANDARD)}
          exiting={FadeOut.duration(motion.timing.FAST)}
        >
          <FormCheckbox
            label={t('storageLocationForm.climateControlled')}
            checked={isClimateControlled}
            onPress={onToggleClimateControlled}
          />

          <View style={styles.capacityRow}>
            <FormNumberInput
              label={t('storageLocationForm.capacity')}
              value={capacity}
              onChangeText={onCapacityChange}
              placeholder={t('storageLocationForm.capacityPlaceholder')}
              keyboardType="decimal-pad"
              containerStyle={styles.capacityInput}
            />
            <FormSelect
              label={t('storageLocationForm.unit')}
              value={capacityUnit}
              onValueChange={onCapacityUnitChange}
              options={buildCapacityUnitOptions(t)}
              placeholder={t('storageLocationForm.unitPlaceholder')}
              containerStyle={styles.capacityUnit}
            />
          </View>

          <FormCheckbox
            label={t('storageLocationForm.setAsDefault')}
            checked={isDefault}
            onPress={onToggleDefault}
          />
        </Animated.View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
  },
  capacityRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  capacityInput: {
    flex: 1,
  },
  capacityUnit: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
