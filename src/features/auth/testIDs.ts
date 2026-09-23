/**
 * The auth screens' testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const authTestIDs = {
  /** `AuthFormTemplate`'s title row: above the keyboard on every auth screen. */
  formTitleRow: 'auth-title-row',

  landingScreen: 'landing-auth-screen',
  landingLoginButton: 'landing-login-button',
  landingSignUpButton: 'landing-signup-button',

  loginScreen: 'login-screen',
  loginEmailInput: 'login-email-input',
  loginPasswordInput: 'login-password-input',
  loginForgotPasswordLink: 'login-forgot-password-link',
  loginSubmitButton: 'login-submit-button',
  loginSignUpLink: 'login-signup-link',

  signUpScreen: 'signup-screen',
  signUpNameInput: 'signup-name-input',
  signUpEmailInput: 'signup-email-input',
  signUpPasswordInput: 'signup-password-input',
  signUpConfirmPasswordInput: 'signup-confirm-password-input',
  signUpSubmitButton: 'signup-submit-button',
  signUpLoginLink: 'signup-login-link',

  forgotPasswordScreen: 'forgot-password-screen',
  forgotPasswordEmailInput: 'forgot-password-email-input',
  forgotPasswordSubmitButton: 'forgot-password-submit-button',
  forgotPasswordLoginLink: 'forgot-password-login-link',
  forgotPasswordSentView: 'forgot-password-sent',
  forgotPasswordBackToLoginButton: 'forgot-password-back-to-login-button',
  forgotPasswordResendLink: 'forgot-password-resend-link',

  resetPasswordScreen: 'reset-password-screen',
  resetPasswordCheckingView: 'reset-password-checking',
  resetPasswordInvalidLinkView: 'reset-password-invalid-link',
  resetPasswordNewInput: 'reset-password-new-input',
  resetPasswordConfirmInput: 'reset-password-confirm-input',
  resetPasswordSubmitButton: 'reset-password-submit-button',

  codeVerificationScreen: 'code-verification-screen',
  codeVerificationResendLink: 'resend-code',
  codeVerificationSkipLink: 'skip-verification',
  codeVerificationSignInLink: 'code-verification-sign-in',

  emailVerifiedSignInButton: 'email-verified-sign-in',
  emailVerificationRetryButton: 'verification-retry',

  postLoginBiometricScreen: 'post-login-biometric-screen',
  /** The `BiometricSetupView` prefix; its buttons are `kitTestIDs.biometric*`. */
  postLoginBiometricView: 'post-login-biometric',
};
