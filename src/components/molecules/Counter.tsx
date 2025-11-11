import React from 'react';
import Icon from '@react-native-vector-icons/ionicons';
import {Text, View, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const Counter = ({
  count,
  onIncrement,
  onDecrement,
  disabled = false,
}: {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
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
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <Pressable
        onPress={handleDecrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.cardAdd,
          pressed && !disabled && styles.pressed,
        ]}>
        <Icon color={disabled ? '#b0b0b0' : '#1d1d1d'} name="remove" size={11} />
      </Pressable>
      <Text style={[styles.counterActionText, disabled && styles.textDisabled]}>{count}</Text>
      <Pressable
        onPress={handleIncrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.cardMinus,
          pressed && !disabled && styles.pressed,
        ]}>
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
