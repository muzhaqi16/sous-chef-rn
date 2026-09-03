import React, { useState, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { SPRING, TIMING } from '#/constants/animations';
import { Text } from '#components/atoms/Text';
import { type UnitType } from '#/graphql/generated/schemaTypes';
import type { PickableUnit } from './unitPickerTypes';
import { MutedActivityIndicator } from '#components/atoms/themedComponents';

export interface PickableUnitGroup {
  type: UnitType;
  label: string;
  units: PickableUnit[];
}

interface UnitPickerProps {
  label: string;
  groups: PickableUnitGroup[];
  selectedUnitId: string | undefined;
  onSelect: (unit: PickableUnit) => void;
  loading: boolean;
}

export const UnitPicker: React.FC<UnitPickerProps> = ({
  label,
  groups,
  selectedUnitId,
  onSelect,
  loading,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Reset collapsed state when groups change (new item loaded)
  const groupFingerprint = groups[0]?.units[0]?.unitId;
  const [prevFingerprint, setPrevFingerprint] = useState(groupFingerprint);
  if (groupFingerprint !== prevFingerprint) {
    setPrevFingerprint(groupFingerprint);
    if (expanded) {
      setExpanded(false);
    }
  }

  // Chevron rotation animation
  const chevronRotation = useSharedValue(0);

  useLayoutEffect(() => {
    chevronRotation.set(withSpring(expanded ? 180 : 0, SPRING.EXPAND));
  }, [expanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  // Find selected unit for collapsed display
  const selectedUnit = groups
    .flatMap(g => g.units)
    .find(u => u.unitId === selectedUnitId);

  const selectedLabel = selectedUnit
    ? selectedUnit.unitSymbol || selectedUnit.unitName
    : undefined;

  const isSelectedLowConfidence =
    selectedUnit?.conversionConfidence != null &&
    selectedUnit.conversionConfidence < 0.8 &&
    !selectedUnit.isTrackingUnit;

  // Auto-collapse after selecting a different unit
  const handleSelect = (unit: PickableUnit) => {
    if (unit.unitId !== selectedUnitId) {
      onSelect(unit);
      setExpanded(false);
    }
  };

  // Data first: a request in flight over a warm cache must not replace the
  // picker with a spinner.
  if (loading && groups.length === 0) {
    return (
      <View style={commonStyles.bottomSheetSection}>
        <View style={styles.collapsedRow}>
          <Text style={commonStyles.bottomSheetSectionLabel}>{label}</Text>
          <MutedActivityIndicator size="small" />
        </View>
      </View>
    );
  }

  // Nothing to show if no groups or only one unit total
  const totalUnits = groups.reduce((sum, g) => sum + g.units.length, 0);
  if (totalUnits <= 1) return null;

  return (
    <View style={commonStyles.bottomSheetSection}>
      {/* Collapsed header row */}
      <AppPressable
        style={styles.collapsedRow}
        onPress={() => setExpanded(prev => !prev)}
      >
        <Text style={commonStyles.bottomSheetSectionLabel}>{label}</Text>
        <View style={styles.collapsedRight}>
          {selectedLabel ? (
            <Text size="base" weight="semibold" tone="accent">
              {selectedLabel}
              {isSelectedLowConfidence ? ' ~' : null}
            </Text>
          ) : null}
          <Animated.View style={animatedChevronStyle}>
            <Icon name="chevron-down" size={20} tone="textSecondary" />
          </Animated.View>
        </View>
      </AppPressable>
      {/* Expanded chip grid */}
      {!!expanded && (
        <Animated.View
          entering={FadeIn.duration(TIMING.STANDARD)}
          exiting={FadeOut.duration(TIMING.FAST)}
          style={styles.expandedContainer}
        >
          {groups.map(group => (
            <View key={group.type} style={styles.groupContainer}>
              {groups.length > 1 && (
                <Text size="xs" tone="secondary" style={styles.groupLabel}>
                  {group.label}
                </Text>
              )}
              <View style={commonStyles.bottomSheetOptionContainer}>
                {group.units.map(unit => {
                  const selected = unit.unitId === selectedUnitId;
                  const isLowConfidence =
                    unit.conversionConfidence != null &&
                    unit.conversionConfidence < 0.8 &&
                    !unit.isTrackingUnit;
                  return (
                    <AppPressable
                      key={unit.unitId}
                      style={[
                        commonStyles.bottomSheetOption,
                        selected && commonStyles.bottomSheetOptionSelected,
                        unit.isTrackingUnit && styles.trackingUnit,
                      ]}
                      onPress={() =>
                        handleSelect({
                          unitId: unit.unitId,
                          unitSymbol: unit.unitSymbol,
                          unitName: unit.unitName,
                          unitType: unit.unitType,
                          isTrackingUnit: unit.isTrackingUnit,
                          conversionRatio: unit.conversionRatio,
                          conversionConfidence: unit.conversionConfidence,
                        })
                      }
                    >
                      <Text
                        style={[
                          commonStyles.bottomSheetOptionText,
                          selected &&
                            commonStyles.bottomSheetOptionTextSelected,
                        ]}
                      >
                        {unit.unitSymbol || unit.unitName}
                        {isLowConfidence ? ' ~' : null}
                      </Text>
                      {selected ? (
                        <Icon name="checkmark" size={16} tone="primary" />
                      ) : null}
                    </AppPressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  collapsedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  expandedContainer: {
    marginTop: theme.spacing.sm,
  },
  groupContainer: {
    marginBottom: theme.spacing.xs,
  },
  groupLabel: {
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackingUnit: {
    borderStyle: 'solid',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
