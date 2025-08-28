import React from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import {StyleSheet} from 'react-native-unistyles';

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
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{label}</Text>
          <TouchableOpacity onPress={onCancel}>
            <FeatherIcon name="x" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={styles.option}
              onPress={() => onSelect(opt.value)}>
              <Text style={styles.optionText}>{opt.label}</Text>
              {selected === opt.value && (
                <FeatherIcon
                  name="check"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {flex: 1, backgroundColor: theme.colors.background, padding: 16},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  optionText: {flex: 1, fontSize: 16, color: theme.colors.textPrimary},
}));
