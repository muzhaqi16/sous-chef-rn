import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {useForm} from 'react-hook-form';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {CommonActions} from '@react-navigation/native';
import {AuthWrapper, AuthFormTemplate} from '../../components/templates';
import {saveCredentials} from '../../storage/keychain';
import {useStore} from '../../store';
import {RememberLoginInfoProps} from '../../navigation';

type RememberValues = {};

export const RememberLoginInfoScreen = ({
  navigation,
}: RememberLoginInfoProps) => {
  const {
    user,
    setRememberMe,
    pendingEmail,
    pendingPassword,
    clearPendingCredentials,
  } = useStore();
  const {styles} = useStyles(stylesheet);
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<{}>({
    defaultValues: {},
  });

  const onRemember = async (choice: boolean) => {
    if (choice && pendingEmail && pendingPassword) {
      await saveCredentials(pendingEmail, pendingPassword);
    }
    setRememberMe(choice);
    clearPendingCredentials();
    // 2) figure out which branch AppNavigator will pick next
    const nextRoute: 'AuthStack' | 'OnBoardingStack' | 'HomeStack' =
      !user || !user.emailVerified || choice === undefined
        ? 'AuthStack'
        : !user?.onBoarded
          ? 'OnBoardingStack'
          : 'HomeStack';

    // 3) reset the *root* navigator into that branch
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: nextRoute}],
      }),
    );
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<RememberValues>
        title="Remember login info?"
        subtitle="We'll remember the login info for your account, so you won't need to enter it on your iCloud devices."
        fields={[]}
        control={control}
        errors={errors}
        submitText="Remember"
        onSubmit={handleSubmit(() => onRemember(true))}
      />

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => onRemember(false)}>
        <Text style={styles.btnSecondaryText}>Skip for now</Text>
      </TouchableOpacity>
    </AuthWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#C8D3D9',
    marginHorizontal: 24,
    marginTop: 12,
  },
  btnSecondaryText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: '#1D2A32',
  },
}));
