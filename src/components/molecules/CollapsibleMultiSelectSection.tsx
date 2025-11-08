import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AnimatedChip } from '#/components/atoms/AnimatedChip';
import { Button } from '#/components/base/Button';
import { Icon } from '#/utils';
import { commonStyles } from '#/styles/commonStyles';

type SelectableItem = {
  id: string;
  label: string;
  value: any;
  selected: boolean;
};

type ExistingItem = {
  id: string;
  label: string;
};

type CollapsibleMultiSelectSectionProps = {
  title: string;
  items: SelectableItem[];
  selectedItems: SelectableItem[];
  existingItems?: ExistingItem[];
  onToggleItem: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: () => Promise<void>;
  onRemove?: (id: string) => void;
  isMaxReached: boolean;
  isSaving?: boolean;
  emptyMessage?: string;
};

export const CollapsibleMultiSelectSection: React.FC<
  CollapsibleMultiSelectSectionProps
> = ({
  title,
  items,
  selectedItems,
  existingItems = [],
  onToggleItem,
  isExpanded,
  onToggleExpand,
  onSave,
  onRemove,
  isMaxReached,
  isSaving = false,
  emptyMessage = 'All items have been added',
}) => {
  const { theme } = useUnistyles();
  const chevronRotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => {
    chevronRotation.value = withSpring(isExpanded ? 180 : 0, {
      mass: 0.8,
      damping: 20,
      stiffness: 200,
    });
    return {
      transform: [{ rotate: `${chevronRotation.value}deg` }],
    };
  });

  const hasItems = items.length > 0;
  const selectedCount = selectedItems.length;
  const existingCount = existingItems.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggleExpand}
        disabled={!hasItems && existingCount === 0}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[
              commonStyles.subtitle,
              styles.headerText,
              !hasItems && existingCount === 0 && styles.headerTextDisabled,
            ]}
          >
            {title}
            {existingCount > 0 && ` (${existingCount})`}
            {selectedCount > 0 && ` - ${selectedCount} selected`}
          </Text>
        </View>
        {(hasItems || existingCount > 0) && (
          <Animated.View style={chevronStyle}>
            <Icon
              library="Feather"
              name="chevron-down"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        )}
      </TouchableOpacity>

      {!hasItems && existingCount === 0 && !isExpanded && (
        <Text style={[commonStyles.bodySecondary, styles.emptyText]}>
          {emptyMessage}
        </Text>
      )}

      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition}
          style={styles.expandedContent}
        >
          {/* Existing Items Section */}
          {existingCount > 0 && (
            <View style={styles.existingSection}>
              <Text style={[commonStyles.caption, styles.sectionLabel]}>
                Added {title}s:
              </Text>
              <View style={styles.chipGrid}>
                {existingItems.map((item) => (
                  <View key={item.id} style={styles.existingChipContainer}>
                    <AnimatedChip
                      label={item.label}
                      selected={true}
                      onPress={() => {}}
                      disabled={true}
                    />
                    {onRemove && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => onRemove(item.id)}
                      >
                        <Icon
                          library="Feather"
                          name="x-circle"
                          size={20}
                          color={theme.colors.danger}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Available Items Section */}
          {hasItems && (
            <>
              {existingCount > 0 && (
                <View style={styles.divider} />
              )}
              <View style={styles.availableSection}>
                {existingCount > 0 && (
                  <Text style={[commonStyles.caption, styles.sectionLabel]}>
                    Add More:
                  </Text>
                )}
                <View style={styles.chipGrid}>
                  {items.map((item) => (
                    <AnimatedChip
                      key={item.id}
                      label={item.label}
                      selected={item.selected}
                      onPress={() => onToggleItem(item.id)}
                      disabled={(!item.selected && isMaxReached) || isSaving}
                    />
                  ))}
                </View>

                {/* Save Button */}
                {selectedCount > 0 && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    layout={LinearTransition}
                    style={styles.saveButtonContainer}
                  >
                    <Button
                      title={
                        isSaving
                          ? 'Adding...'
                          : `Add ${selectedCount} ${title}${selectedCount === 1 ? '' : 's'}`
                      }
                      onPress={onSave}
                      disabled={isSaving || selectedCount === 0}
                      loading={isSaving}
                      variant="primary"
                      btnStyle={styles.saveButton}
                    />
                  </Animated.View>
                )}
              </View>
            </>
          )}

          {/* Empty state when all items are added */}
          {!hasItems && existingCount === 0 && (
            <Text style={[commonStyles.bodySecondary, styles.emptyExpandedText]}>
              {emptyMessage}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerText: {
    fontWeight: '600',
  },
  headerTextDisabled: {
    color: theme.colors.textSecondary,
  },
  emptyText: {
    padding: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    fontSize: 13,
  },
  expandedContent: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  existingSection: {
    marginBottom: theme.spacing.md,
  },
  availableSection: {
    // No margin needed
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  existingChipContainer: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  saveButtonContainer: {
    marginTop: theme.spacing.md,
  },
  saveButton: {
    width: '100%',
  },
  emptyExpandedText: {
    textAlign: 'center',
    padding: theme.spacing.md,
  },
}));
