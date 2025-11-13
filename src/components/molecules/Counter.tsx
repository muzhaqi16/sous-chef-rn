import React from 'react';
import Icon from '@react-native-vector-icons/ionicons';
import {Text, View, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const Counter = ({
  count,
  onIncrement,
  onDecrement,
  disabled = false,
  label = 'quantity',
}: {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  label?: string;
}) => {
  const handleDecrement = (e: any) => {
    e.stopPropagation();
    if (!disabled) {
      onDecrement();
    }
  };

  const handleIncrement = (e: any) => {
    e.stopPropagation();
    if (!disabled) {
      onIncrement();
    }
  };

  return (
    <View
      style={[styles.container, disabled && styles.containerDisabled]}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityValue={{
        min: 0,
        now: count,
        text: String(count),
      }}
      accessibilityActions={[
        { name: 'increment', label: `Increase ${label}` },
        { name: 'decrement', label: `Decrease ${label}` },
      ]}
      onAccessibilityAction={(event) => {
        switch (event.nativeEvent.actionName) {
          case 'increment':
            if (!disabled) onIncrement();
            break;
          case 'decrement':
            if (!disabled) onDecrement();
            break;
        }
      }}
    >
      <Pressable
        onPress={handleDecrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.cardAdd,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
        <Icon color={disabled ? '#b0b0b0' : '#1d1d1d'} name="remove" size={11} />
      </Pressable>
      <Text
        style={[styles.counterActionText, disabled && styles.textDisabled]}
        accessibilityLabel={`${label} count: ${count}`}
      >
        {count}
      </Text>
      <Pressable
        onPress={handleIncrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.cardMinus,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
        <Icon color={disabled ? '#b0b0b0' : '#1d1d1d'} name="add" size={11} />
      </Pressable>
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    borderColor: '#ececec',
    borderStyle: 'solid',
    borderRadius: 9999,
  },
  cardAdd: {
    zIndex: 9,
    backgroundColor: theme.colors.surface,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  counterActionText: {
    fontSize: 20,
    paddingHorizontal: 10,

    lineHeight: 20,
    fontWeight: '500',
    color: '#000',
  },
  cardMinus: {
    zIndex: 9,
    backgroundColor: theme.colors.surface,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  containerDisabled: {
    borderColor: '#d0d0d0',
  },
  textDisabled: {
    color: '#b0b0b0',
  },
}));
