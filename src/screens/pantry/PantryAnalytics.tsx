import React from 'react';
import { View } from 'react-native';
import { commonStyles } from '#/styles/commonStyles';
import { EmptyState } from '#components/base/EmptyState';
import type { StaticScreenProps } from '@react-navigation/native';

type PantryAnalyticsProps = StaticScreenProps<{
  pantryId: string;
}>;

export const PantryAnalytics: React.FC<PantryAnalyticsProps> = () => {
  return (
    <View style={commonStyles.container}>
      <EmptyState
        icon="analytics"
        iconLibrary="Ionicons"
        title="Analytics Coming Soon"
        description="Pantry analytics are being redesigned. Check back in a future update."
      />
    </View>
  );
};
