import React, {useEffect, useRef} from 'react';
import {Text, Pressable, ScrollView} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#/utils/iconUtils';
import {ActionTray} from '#components/templates/ActionTray/ActionTray';
import type {ActionTrayRef} from '#components/templates/ActionTray/types';

export interface ModalPickerProps {
  label: string;
  visible: boolean;
  options: {label: string; value: string}[];
  selected: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export const ModalPicker: React.FC<ModalPickerProps> = ({
  label,
  visible,
  options,
  selected,
  onSelect,
  onCancel,
}) => {
  const {theme} = useUnistyles();
  const trayRef = useRef<ActionTrayRef>(null);

  // Bridge declarative `visible` prop → imperative ActionTray ref
  useEffect(() => {
    if (visible) {
      trayRef.current?.open();
    } else {
      trayRef.current?.close();
    }
  }, [visible]);

  return (
    <ActionTray ref={trayRef} title={label} onClose={onCancel}>
      <ScrollView>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            style={({pressed}) => [styles.option, pressed && styles.pressed]}
            onPress={() => onSelect(opt.value)}>
            <Text style={styles.optionText}>{opt.label}</Text>
            {selected === opt.value && (
              <Icon
                name="checkmark"
                size={20}
                color={theme.colors.primary}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </ActionTray>
  );
};

const styles = StyleSheet.create(theme => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  optionText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
