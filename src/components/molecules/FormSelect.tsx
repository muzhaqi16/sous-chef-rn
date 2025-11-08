import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps {
  label: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  required?: boolean;
  placeholder?: string;
  containerStyle?: any;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  value,
  onValueChange,
  options,
  error,
  required = false,
  placeholder = 'Select an option',
  containerStyle,
}) => {
  const {theme} = useUnistyles();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(option => option.value === value);

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      ...containerStyle,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    required: {
      color: '#dc3545',
    },
    selectButton: {
      borderWidth: 1,
      borderColor: error ? '#dc3545' : theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectText: {
      fontSize: 16,
      color: selectedOption
        ? theme.colors.textPrimary
        : theme.colors.textSecondary,
    },
    errorText: {
      fontSize: 14,
      color: '#dc3545',
      marginTop: 4,
    },
    modal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      maxHeight: '80%',
      width: '90%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    selectedOption: {
      backgroundColor: theme.colors.primary + '20',
    },
    optionText: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    selectedOptionText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    closeButton: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: theme.colors.border,
      borderRadius: 8,
      alignSelf: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontWeight: '500',
    },
  });

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setModalVisible(false);
  };

  const renderOption = ({item}: {item: SelectOption}) => {
    const isSelected = item.value === value;
    return (
      <TouchableOpacity
        style={[styles.option, isSelected && styles.selectedOption]}
        onPress={() => handleSelect(item.value)}>
        <Text
          style={[styles.optionText, isSelected && styles.selectedOptionText]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => setModalVisible(true)}>
        <Text style={styles.selectText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Icon
          name="keyboard-arrow-down"
          size={24}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={item => item.value}
              showsVerticalScrollIndicator={false}
              // Performance optimizations
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              initialNumToRender={10}
              updateCellsBatchingPeriod={50}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
