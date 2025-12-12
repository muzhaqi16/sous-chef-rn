import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon, IconName, IconLibrary} from '#utils/iconUtils';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

interface FABProps {
  onPress?: () => void;
  icon?: IconName;
  library?: IconLibrary;
  position?: {bottom?: number; right?: number; left?: number; top?: number};
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const FAB: React.FC<FABProps> = ({
  onPress = () => {},
  icon = 'add',
  library = 'MaterialIcons',
  position = {bottom: 20, right: 20},
  accessibilityLabel = 'Add',
  accessibilityHint = 'Tap to add a new item',
}) => {
  const {bottom: safeBottom} = useSafeAreaInsets();
  const {theme} = useUnistyles();

  // Calculate position above tab bar
  const fabPosition = React.useMemo(
    () => ({
      ...position,
      bottom: TAB_BAR_HEIGHT + safeBottom + (position.bottom || 20),
    }),
    [position, safeBottom],
  );

  return (
    <View style={[styles.fab, fabPosition]}>
      <TouchableOpacity
        style={styles.fabButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}>
        <Icon name={icon} size={24} color={theme.colors.white} library={library} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    zIndex: theme.zIndex.fab,
    ...theme.shadows.lg,
  },
  fabButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.full,
  },
}));
