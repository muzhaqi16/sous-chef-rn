import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { unitLabel } from '#/utils/formatQuantity';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { commonStyles } from '#/styles/commonStyles';

import { Text } from '#components/atoms/Text';
import type { UnitType } from '#/graphql/generated/schemaTypes';
import { MutedActivityIndicator } from '#components/atoms/themedComponents';
import { motion } from '#/theme/motion';
import type { PickableUnit } from '#features/pantry/types';

export interface PickableUnitGroup {
  type: UnitType;
  label: string;
  units: PickableUnit[];
}

interface UnitPickerProps {
  label: string;
  /** Every unit the stack takes, in the server's order. */
  ranked: PickableUnit[];
  groups: PickableUnitGroup[];
  selectedUnitId: string | undefined;
  onSelect: (unit: PickableUnit) => void;
  loading: boolean;
}

/** How many units lead; the rest wait behind More. */
const LEADING_UNITS = 3;

/**
 * The leading units, in the server's order. The package stays among them, so a
 * whole one is used without More, however far a last-used unit pushes it, and
 * so does a unit picked from More.
 */
function leadingUnits(
  ranked: PickableUnit[],
  selectedUnitId: string | undefined,
): PickableUnit[] {
  const isKept = (unit: PickableUnit) =>
    unit.isTrackingUnit || unit.unitId === selectedUnitId;
  const shown = new Set(
    [...ranked.filter(isKept), ...ranked.filter(unit => !isKept(unit))].slice(
      0,
      LEADING_UNITS,
    ),
  );
  return ranked.filter(unit => shown.has(unit));
}

export const UnitPicker: React.FC<UnitPickerProps> = ({
  label,
  ranked,
  groups,
  selectedUnitId,
  onSelect,
  loading,
}) => {
  const { t } = useTranslation();
  const [showingAll, setShowingAll] = useState(false);

  // Back to the leading units when a new item's load.
  const fingerprint = ranked[0]?.unitId;
  const [prevFingerprint, setPrevFingerprint] = useState(fingerprint);
  if (fingerprint !== prevFingerprint) {
    setPrevFingerprint(fingerprint);
    if (showingAll) setShowingAll(false);
  }

  const handleSelect = (unit: PickableUnit) => {
    if (unit.unitId !== selectedUnitId) onSelect(unit);
    setShowingAll(false);
  };

  // Data first: a request in flight over a warm cache must not replace the
  // picker with a spinner.
  if (loading && ranked.length === 0) {
    return (
      <View style={commonStyles.bottomSheetSection}>
        <View style={styles.loadingRow}>
          <Text role="label" style={commonStyles.bottomSheetSectionLabel}>
            {label}
          </Text>
          <MutedActivityIndicator size="small" />
        </View>
      </View>
    );
  }

  // Nothing to choose with one unit or none.
  if (ranked.length <= 1) return null;

  const chip = (unit: PickableUnit) => {
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
        accessibilityState={{ selected }}
        onPress={() => handleSelect(unit)}
      >
        <Text
          role="caption"
          style={[
            commonStyles.bottomSheetOptionText,
            selected && commonStyles.bottomSheetOptionTextSelected,
          ]}
        >
          {unitLabel(unit.unit)}
          {isLowConfidence ? ' ~' : null}
        </Text>
        {selected ? <Icon name="checkmark" size={16} tone="primary" /> : null}
      </AppPressable>
    );
  };

  return (
    <View style={commonStyles.bottomSheetSection}>
      <Text role="label" style={commonStyles.bottomSheetSectionLabel}>
        {label}
      </Text>
      {showingAll ? (
        <Animated.View
          entering={FadeIn.duration(motion.timing.STANDARD)}
          exiting={FadeOut.duration(motion.timing.FAST)}
          style={styles.units}
        >
          {groups.map(group => (
            <View key={group.type} style={styles.groupContainer}>
              {groups.length > 1 && (
                <Text role="caption" tone="secondary" style={styles.groupLabel}>
                  {group.label}
                </Text>
              )}
              <View style={commonStyles.bottomSheetOptionContainer}>
                {group.units.map(chip)}
              </View>
            </View>
          ))}
        </Animated.View>
      ) : (
        <View style={[commonStyles.bottomSheetOptionContainer, styles.units]}>
          {leadingUnits(ranked, selectedUnitId).map(chip)}
          {ranked.length > LEADING_UNITS ? (
            <AppPressable
              style={commonStyles.bottomSheetOption}
              accessibilityRole="button"
              onPress={() => {
                setShowingAll(true);
              }}
            >
              <Text role="caption" style={commonStyles.bottomSheetOptionText}>
                {t('labels.more')}
              </Text>
            </AppPressable>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  units: {
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
}));
