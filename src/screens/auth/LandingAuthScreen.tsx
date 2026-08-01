import React from 'react';
import { logger } from '#/utils/environment';
import { useTranslation } from 'react-i18next';
import { View, Image, Linking } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { Button } from '#components/base/Button';
import { Link } from '#components/atoms/Link';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { getWebAppUrl } from '#utils/environment';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';

export function LandingAuthScreen() {
  const { t } = useTranslation();
  const { toLogin, toSignUp } = useAppNavigation();

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
          {t('auth.landingTitle')}
        </Text>

        <View style={styles.divider} />

        <Text
          size="md"
          weight="medium"
          tone="secondary"
          align="left"
          style={styles.subtitle}
        >
          {t('auth.landingSubtitle')}
        </Text>

        <View style={styles.buttons}>
          <Button
            testID="landing-login-button"
            title={t('auth.logIn')}
            onPress={toLogin}
            variant="secondary"
            fullWidth
            txtStyle={styles.txt}
          />
          <Button
            testID="landing-signup-button"
            title={t('auth.signUp')}
            onPress={toSignUp}
            fullWidth
            txtStyle={styles.txt}
          />
        </View>

        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => {
            Linking.openURL(getWebAppUrl('/privacy-policy')).catch(err =>
              logger.warn('Failed to open URL:', err),
            );
          }}
        >
          <Text
            size="sm"
            tone="secondary"
            align="center"
            style={styles.footerText}
          >
            {t('auth.legalNotice')}
            {'\n'}
            <Link variant="subtle">{t('auth.termsLink')}</Link>{' '}
            {t('auth.legalAnd')}{' '}
            <Link variant="subtle">{t('auth.privacyLink')}</Link>.
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
    borderCurve: 'continuous',
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
