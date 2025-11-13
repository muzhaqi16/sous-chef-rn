import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

interface FABProps {
  onPress?: () => void;
  icon?: IconName;
  library?: IconLibrary;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const FAB: React.FC<FABProps> = ({
  onPress = () => {},
  icon = 'add',
  library = 'MaterialIcons',
  position = { bottom: 20, right: 20 },
  accessibilityLabel = 'Add',
  accessibilityHint = 'Tap to add a new item',
}) => {
  const { bottom: safeBottom } = useSafeAreaInsets();

  // Calculate position above tab bar
  const fabPosition = React.useMemo(() => ({
    ...position,
    bottom: TAB_BAR_HEIGHT + safeBottom + (position.bottom || 20),
  }), [position, safeBottom]);

  return (
    <View style={[styles.fab, fabPosition]}>
      <TouchableOpacity
        style={styles.fabButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        <Icon name={icon} size={24} color="white" library={library} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 999, // Just below the tab bar but above everything else
  },
  fabButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
}));
