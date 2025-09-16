import React, {useRef} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const CodeInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  error?: string;
}> = ({value, onChange}) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <TouchableOpacity onPress={() => inputRef.current?.focus()}>
      <View style={styles.formInput}>
        <TextInput
          ref={inputRef}
          style={styles.formInputControl}
          keyboardType="number-pad"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          caretHidden
          value={value}
          onChangeText={v => onChange(v.slice(0, 6))}
          returnKeyType="done"
        />
        <View style={styles.formInputOverflow}>
          {Array.from({length: 6}).map((_, idx) => (
            <Text key={idx} style={styles.formInputChar}>
              {value[idx] ?? <Text style={styles.formInputCharEmpty}>-</Text>}
            </Text>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  formInput: {
    position: 'relative',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  formInputControl: {
    height: 60,
    color: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    zIndex: 2,
    opacity: 0,
  },
  formInputOverflow: {
    zIndex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  formInputChar: {
    flex: 1,
    lineHeight: 60,
    fontSize: 34,
    textAlign: 'center',
    fontWeight: '600',
  },
  formInputCharEmpty: {
    color: '#BBB9BC',
    fontWeight: '400',
  },
}));
