import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Button } from '#/components/base/Button';
import { Text } from '#components/atoms/Text';

export const NotFoundScreen = () => {
  const { t } = useTranslation();
  const { dispatch } = useNavigation();

  const handleGoHome = () => {
    dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
  };

  return (
    <View style={styles.container}>
      <Text size="md" align="center" style={styles.text}>
        {t('notFound.message')}
      </Text>
      <View style={styles.buttonContainer}>
        <Button onPress={handleGoHome} variant="primary">
          {t('notFound.goToHome')}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  text: {
    marginBottom: theme.spacing.lg,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 200,
  },
}));

export default NotFoundScreen;
