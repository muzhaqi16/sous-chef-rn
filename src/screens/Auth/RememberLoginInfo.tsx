import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {useForm} from 'react-hook-form';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {
  RememberLoginInfoProps as Props,
  type RememberNavProp,
} from '../../navigation';
import {useSafeNavigation} from '../../hooks';
import {saveCredentials} from '../../storage/keychain';
import {useStore} from '../../store';

type RememberValues = {};

export const RememberLoginInfoScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const {email, password, user, accessToken, refreshToken} = route.params;
  const setAuth = useStore(s => s.setAuth);
  const {goBack} = useSafeNavigation<RememberNavProp>();
  const canGoBack = navigation.canGoBack();
  const {styles} = useStyles(stylesheet);
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<{}>({
    defaultValues: {},
  });

  const onRemember = async () => {
    await saveCredentials(email, password);
    setAuth(user, accessToken, refreshToken);
    goBack();
  };
  const onSkip = () => {
    setAuth(user, accessToken, refreshToken);
    goBack();
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
        onSubmit={handleSubmit(onRemember)}
      />

      <TouchableOpacity style={styles.btnSecondary} onPress={onSkip}>
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
