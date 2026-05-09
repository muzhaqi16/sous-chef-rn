import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { Button } from '#components/base/Button';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

export interface ModalPickerProps {
  label: string;
  visible: boolean;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
  /** When set, tapping an option only highlights it; a button with this label confirms the selection. */
  confirmLabel?: string;
}

export const ModalPicker: React.FC<ModalPickerProps> = ({
  label,
  visible,
  options,
  selected,
  onSelect,
  onCancel,
  confirmLabel,
}) => {
  const trayRef = useRef<ActionTrayRef>(null);

  // Local pending selection for confirm mode
  const [pendingValue, setPendingValue] = useState(selected);

  // Sync pending value when the external selected prop changes (state-during-render pattern)
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setPendingValue(selected);
  }

  // Bridge declarative `visible` prop → imperative ActionTray ref
  useEffect(() => {
    if (visible) {
      trayRef.current?.open();
    } else {
      trayRef.current?.close();
    }
  }, [visible]);

  const activeValue = confirmLabel ? pendingValue : selected;

  return (
    <ActionTray ref={trayRef} title={label} onClose={onCancel}>
      <ScrollView>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={() => {
              if (confirmLabel) {
                setPendingValue(opt.value);
              } else {
                onSelect(opt.value);
              }
            }}
          >
            <Text size="base" style={styles.optionText}>
              {opt.label}
            </Text>
            {activeValue === opt.value && (
              <Icon name="checkmark" size={20} tone="primary" />
            )}
          </Pressable>
        ))}
      </ScrollView>
      {confirmLabel ? (
        <View style={styles.footer}>
          <Button
            title={confirmLabel}
            onPress={() => onSelect(pendingValue)}
            disabled={pendingValue === selected}
            fullWidth
          />
        </View>
      ) : null}
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
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  footer: {
    paddingTop: theme.spacing['3'],
  },
}));
