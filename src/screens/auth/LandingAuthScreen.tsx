import React from 'react';
import { View, Image, Linking } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { CommonActions } from '@react-navigation/native';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { Button } from '#components/base/Button';
import { Link } from '#components/atoms/Link';
import { useSafeNavigation } from '#hooks/navigation/useSafeNavigation';
import { getWebAppUrl } from '#utils/environment';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';

export function LandingAuthScreen() {
  const { navigation } = useSafeNavigation();

  return (
    <AuthWrapper testID="landing-auth-screen">
      {/* 1. Hero image flex-zone */}
      <View style={styles.heroContainer}>
        <Image
          source={appConfig.assets.logo}
          style={styles.hero}
          resizeMode="contain"
        />
      </View>

      {/* 2. Content flex-zone */}
      <View style={styles.content}>
        <Text size="lg" weight="bold" align="left">
          End Waste, Save Time & Money
        </Text>

        <View style={styles.divider} />

        <Text
          size="md"
          weight="medium"
          tone="secondary"
          align="left"
          style={styles.subtitle}
        >
          Know what you have, plan what's next, and shop smarter every time.
        </Text>

        <View style={styles.buttons}>
          <Button
            testID="landing-login-button"
            title="Log In"
            onPress={() => navigation.dispatch(CommonActions.navigate('Login'))}
            variant="secondary"
            fullWidth
            txtStyle={styles.txt}
          />
          <Button
            testID="landing-signup-button"
            title="Sign Up"
            onPress={() =>
              navigation.dispatch(CommonActions.navigate('SignUp'))
            }
            fullWidth
            txtStyle={styles.txt}
          />
        </View>

        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => {
            Linking.openURL(getWebAppUrl('/privacy-policy')).catch(err =>
              console.error('Failed to open URL:', err),
            );
          }}
        >
          <Text
            size="sm"
            tone="secondary"
            align="center"
            style={styles.footerText}
          >
            By continuing, you agree to our{'\n'}
            <Link variant="subtle">Terms & Conditions</Link> and{' '}
            <Link variant="subtle">Privacy Policy</Link>.
          </Text>
        </Pressable>
      </View>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: 300,
    height: 300,
  },

  content: {
    paddingBottom: theme.spacing.xl,
  },

  divider: {
    width: 40,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xs,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  txt: {
    textTransform: 'uppercase',
  },
  subtitle: {
    lineHeight: theme.spacing.lg,
    width: '100%',
  },

  buttons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },

  footerText: {
    lineHeight: theme.fonts.size.md * 1.5,
    marginTop: theme.spacing.lg,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
