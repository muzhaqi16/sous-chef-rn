import { useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';

/**
 * The three contexts a biometric enrollment card can appear in. They differ
 * only in copy, where the password comes from, and what completion does — the
 * actual UI + storeCredentials logic is identical, which is why it lives here.
 *
 * - `onboarding` — last step of the registration flow (full screen).
 * - `postLogin`  — returning-user enrollment gate shown after a fresh login,
 *                  before the main app (full screen). Availability is
 *                  pre-checked by `shouldShowPostLoginBiometricPrompt`.
 * - `settings`   — manual enable/disable from Profile → Security (modal).
 */
export type BiometricSetupMode = 'onboarding' | 'postLogin' | 'settings';

interface BiometricInfo {
  isAvailable: boolean;
  biometryType: string | null;
}

interface UseBiometricSetupParams {
  mode: BiometricSetupMode;
  userEmail: string;
  /** Pre-supplied password (registration password / fresh login password). */
  presetPassword?: string;
  /** When false the card is dormant and skips the availability probe (modal). */
  active?: boolean;
  onComplete: (enabled: boolean, declined?: boolean) => void;
}

const biometryIcon = (type: string | null): string => {
  switch (type) {
    case 'Face ID':
      return 'scan-outline';
    case 'Touch ID':
    case 'Fingerprint':
      return 'finger-print';
    default:
      return 'finger-print';
  }
};

/**
 * Module-level loader — keeps the try/catch out of the hook body so the React
 * Compiler doesn't bail out of auto-memoization (see CLAUDE.md). Returns a safe
 * "unavailable" snapshot on error.
 */
async function loadBiometricSnapshot(
  mode: BiometricSetupMode,
  userEmail: string,
): Promise<{ info: BiometricInfo; hasCredentials: boolean }> {
  try {
    const [info, hasCredentials] = await Promise.all([
      authService.getBiometricInfo(),
      mode === 'settings'
        ? authService.checkStoredCredentials(userEmail)
        : Promise.resolve(false),
    ]);
    return { info, hasCredentials };
  } catch (error) {
    errorService.reportError(error, { operation: 'loadBiometricInfo' });
    return {
      info: { isAvailable: false, biometryType: null },
      hasCredentials: false,
    };
  }
}

/**
 * Centralized biometric-enrollment logic. Shared by every enrollment surface
 * (onboarding step, post-login gate, settings modal) so copy, the
 * availability probe, the password requirement, and the `storeCredentials`
 * call live in exactly one place. Render the returned values with
 * `BiometricSetupView`.
 */
export const useBiometricSetup = ({
  mode,
  userEmail,
  presetPassword,
  active = true,
  onComplete,
}: UseBiometricSetupParams) => {
  const { t } = useTranslation();
  // postLogin availability is pre-checked upstream, so default to available
  // there to avoid a blank flash before the probe resolves.
  const [info, setInfo] = useState<BiometricInfo>({
    isAvailable: mode === 'postLogin',
    biometryType: null,
  });
  const [checked, setChecked] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [password, setPassword] = useState(presetPassword ?? '');
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);

  // Adopt a preset password that resolves after mount (e.g. onboarding loading
  // the temp password from the keychain). "Adjusting state during render" per
  // CLAUDE.md instead of an effect — no ref, no extra commit.
  const [lastPreset, setLastPreset] = useState(presetPassword);
  if (presetPassword !== lastPreset) {
    setLastPreset(presetPassword);
    if (presetPassword) setPassword(presetPassword);
  }

  // Probe device capability whenever the card becomes active. State is only
  // set from the async callback (never synchronously in the effect body) so we
  // don't trigger cascading renders.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadBiometricSnapshot(mode, userEmail).then(
      ({ info: probed, hasCredentials }) => {
        if (cancelled) return;
        setInfo(probed);
        setHasExistingCredentials(hasCredentials);
        setChecked(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, mode, userEmail]);

  // Device can't do biometrics → quietly complete (NOT a user decline).
  useEffect(() => {
    if (active && checked && !info.isAvailable) {
      onComplete(false);
    }
  }, [active, checked, info.isAvailable, onComplete]);

  // Settings re-enable when credentials already exist is a re-auth, not a
  // store; everywhere else we need a password to write credentials.
  const needsPassword =
    mode === 'settings' ? !hasExistingCredentials : !presetPassword;

  const handleEnable = () => {
    if (isEnabling) return;

    executeWithLoadingState(
      async () => {
        // Settings + existing credentials: just re-authenticate via biometrics.
        if (mode === 'settings' && hasExistingCredentials) {
          const credentials = await authService.loadStoredCredentials(
            userEmail,
          );
          if (credentials) {
            onComplete(true);
          } else {
            alertService.alert(
              t('biometricSetup.authRequiredTitle'),
              t('biometricSetup.authRequiredMessage'),
              [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
            );
          }
          return;
        }

        const passwordToUse = presetPassword || password;
        if (needsPassword && !passwordToUse.trim()) {
          alertService.alert(
            t('biometricSetup.passwordRequiredTitle'),
            mode === 'settings'
              ? t('biometricSetup.passwordRequiredAccountMessage')
              : t('biometricSetup.passwordRequiredMessage'),
          );
          return;
        }

        const success = await authService.storeCredentials(
          userEmail,
          passwordToUse,
        );
        if (success) {
          onComplete(true);
        } else {
          alertService.alert(
            t('biometricSetup.setupFailedTitle'),
            mode === 'settings'
              ? t('biometricSetup.setupFailedPasswordMessage')
              : t('biometricSetup.setupFailedGenericMessage'),
            [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
          );
        }
      },
      setIsEnabling,
      error => {
        errorService.reportError(error, { operation: 'enableBiometricAuth' });
        alertService.alert(
          t('biometricSetup.setupFailedTitle'),
          t('biometricSetup.setupFailedGenericMessage'),
          [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
        );
      },
    );
  };

  // "Set up later" / "Not now" — an explicit decline everywhere except
  // settings (where dismissing the modal isn't a permanent "don't ask again").
  const handleSkip = () => {
    onComplete(false, mode !== 'settings');
  };

  const fallbackType =
    info.biometryType ||
    (mode === 'postLogin'
      ? t('postLoginBiometric.biometricFallback')
      : t('biometricSetup.biometricFallback'));
  const authTypeLabel =
    info.biometryType ||
    (mode === 'postLogin'
      ? t('postLoginBiometric.biometricAuthLabel')
      : t('biometricSetup.biometricAuthLabel'));

  return {
    checking: !checked,
    available: info.isAvailable,
    biometryType: info.biometryType,
    iconName: biometryIcon(info.biometryType),
    title:
      mode === 'postLogin'
        ? t('postLoginBiometric.title', { type: fallbackType })
        : t('biometricSetup.title', { type: fallbackType }),
    description:
      mode === 'postLogin'
        ? t('postLoginBiometric.description', { authType: authTypeLabel })
        : t('biometricSetup.description', { authType: authTypeLabel }),
    benefits: [
      t('biometricSetup.benefitQuickAccess'),
      t('biometricSetup.benefitNoPassword'),
      t('biometricSetup.benefitEnhancedSecurity'),
    ],
    footer: t('biometricSetup.footer'),
    needsPassword,
    password,
    setPassword,
    passwordLabel:
      mode === 'settings'
        ? t('biometricSetup.passwordPromptCurrent')
        : t('biometricSetup.passwordPromptInitial'),
    passwordPlaceholder: t('biometricSetup.passwordPlaceholder'),
    isEnabling,
    enableLabel: isEnabling
      ? t('biometricSetup.settingUp')
      : t('labels.enableNow'),
    skipLabel:
      mode === 'postLogin'
        ? t('labels.notNow')
        : t('biometricSetup.setupLater'),
    handleEnable,
    handleSkip,
  };
};
