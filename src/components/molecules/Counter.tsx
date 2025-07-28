import React from 'react';
import Icon from '@react-native-vector-icons/ionicons';
import {Text, View, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const Counter = ({
  count,
  onIncrement,
  onDecrement,
}: {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onDecrement} style={styles.cardAdd}>
        <Icon color="#1d1d1d" name="remove" size={11} />
      </TouchableOpacity>
      <Text style={styles.counterActionText}>{count}</Text>
      <TouchableOpacity onPress={onIncrement} style={styles.cardMinus}>
        <Icon color="#1d1d1d" name="add" size={11} />
      </TouchableOpacity>
    </View>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    backgroundColor: theme.colors.white,
    borderColor: '#ececec',
    borderStyle: 'solid',
    borderRadius: 9999,
  },
  cardAdd: {
    zIndex: 9,
    backgroundColor: '#fff',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    shadowColor: '#000',
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
    backgroundColor: '#fff',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
}));
