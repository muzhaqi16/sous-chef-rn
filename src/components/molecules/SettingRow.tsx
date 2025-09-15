import React, {useState, JSX} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Switch,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import Ionicons from '@react-native-vector-icons/ionicons';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ValueText} from '../atoms/ValueText';

export type SettingType = 'text' | 'switch' | 'modal' | 'radio';

export interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  icon?: JSX.Element;
  value?: string | boolean;
  onPress?: () => void;
  onSave?: (val: any) => void;
  options?: {label: string; value: string}[];
  selected?: string;
}

export interface SettingRowProps {
  item: SettingItem;
  isFirst: boolean;
  isLast: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  item,
  isFirst,
  isLast,
}) => {
  const {styles, theme} = useStyles(stylesheet);
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={item.type === 'text' ? 1 : 0.7}
        onPress={handlePress}
        style={[
          styles.rowWrapper,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
        ]}>
        <View style={styles.row}>
          {item.icon}
          <Text style={styles.rowLabel}>{item.label}</Text>
          <View style={styles.rowSpacer} />

          {item.type === 'text' && (
            <ValueText>{item.value as string}</ValueText>
          )}

          {item.type === 'switch' && (
            <Switch
              value={item.value as boolean}
              onValueChange={item.onPress}
            />
          )}

          {item.type === 'radio' && item.options && (
            <Ionicons
              name={
                item.selected === item.value
                  ? 'radio-button-on'
                  : 'radio-button-off'
              }
              size={20}
              color={
                item.selected === item.value
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
          )}

          {item.type === 'modal' && (
            <FeatherIcon
              name="chevron-right"
              size={20}
              color={theme.colors.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>

      {item.type === 'modal' && item.options && (
        <Modal visible={modalVisible} animationType="slide">
          <SafeAreaView style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{item.label}</Text>
            <ScrollView>
              {item.options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.modalOption}
                  onPress={() => {
                    item.onSave?.(opt.value);
                    setModalVisible(false);
                  }}>
                  <Text style={styles.modalOptionText}>{opt.label}</Text>
                  {item.value === opt.value && (
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
      )}
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
  rowWrapper: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
  },
  rowFirst: {borderTopLeftRadius: 12, borderTopRightRadius: 12},
  rowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  rowLabel: {marginLeft: 8, fontSize: 16, color: theme.colors.textPrimary},
  rowSpacer: {flex: 1},
  modalContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  modalTitle: {fontSize: 18, fontWeight: '600', marginBottom: 16},
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalOptionText: {fontSize: 16, flex: 1, color: theme.colors.textPrimary},
}));
