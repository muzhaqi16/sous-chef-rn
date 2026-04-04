import React from 'react';
import { View, Image, Text, Linking } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { CommonActions } from '@react-navigation/native';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { Button } from '#components/base/Button';
import { useSafeNavigation } from '#hooks/navigation/useSafeNavigation';
import { getWebAppUrl } from '#utils/environment';

export function LandingAuthScreen() {
  const { navigation } = useSafeNavigation();

  return (
    <AuthWrapper testID="landing-auth-screen">
      {/* 1. Hero image flex-zone */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.hero}
          resizeMode="contain"
        />
      </View>

      {/* 2. Content flex-zone */}
      <View style={styles.content}>
        <Text style={styles.title}>End Waste, Save Time & Money</Text>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>
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
          <Text style={styles.footerText}>
            By continuing, you agree to our{'\n'}
            <Text style={styles.link}>Terms & Conditions</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
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

  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'left',
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
    fontSize: theme.fonts.size.md,
    lineHeight: theme.spacing.lg,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    textAlign: 'left',
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
    fontSize: theme.fonts.size.sm,
    lineHeight: theme.fonts.size.md * 1.5,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  link: {
    color: theme.colors.textOnSurfaceVariant,
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
