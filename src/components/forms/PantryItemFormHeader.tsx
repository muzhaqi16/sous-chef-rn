import React from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {Icon} from '#utils';
import {useNavigation} from '@react-navigation/native';
import {useUnistyles} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';

interface PantryItemFormHeaderProps {
  title: string;
  onSave: () => void;
  saving?: boolean;
  testID?: string;
}

export const PantryItemFormHeader: React.FC<PantryItemFormHeaderProps> = ({
  title,
  onSave,
  saving = false,
  testID,
}) => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  return (
    <View style={commonStyles.header}>
      <TouchableOpacity
        style={commonStyles.iconButton}
        onPress={() => navigation.goBack()}
        testID="pantry-item-form-close-button"
        accessible={false}>
        <Icon name="close" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      <Text style={commonStyles.headerTitle}>{title}</Text>
      <TouchableOpacity
        style={commonStyles.iconButton}
        onPress={onSave}
        disabled={saving}
        testID={testID}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        {saving ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Text
            style={{
              fontSize: theme.fonts.size.base,
              fontWeight: theme.fonts.weight.semibold,
              color: theme.colors.primary,
            }}>
            Save
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};
