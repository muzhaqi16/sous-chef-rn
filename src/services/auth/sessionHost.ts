import type { LoginUserFragment } from '#operations/auth/userFragments.generated';
import { errorService } from '#/services/errorService';

/** What follows a password sign-in before the app opens, if anything. */
export type PostSignInGate = 'biometricSetup' | 'rememberMe' | null;

/**
 * What a host adds to a session. The core signs in and out; a host with a
 * device behind it also registers that device and guards the sign-in it
 * stores. A host with neither registers nothing.
 */
export interface SessionHost {
  /** After a sign-in commits, off its critical path. */
  afterSignIn(): void;
  /**
   * Decided before auth state changes, so the gate and the session commit
   * together; `signInToken` authorises any call it makes, the pair not yet
   * being stored.
   */
  postSignInGate(
    user: LoginUserFragment,
    email: string,
    offerRememberMe: boolean,
    signInToken: string,
  ): Promise<PostSignInGate>;
  /**
   * Drops the sign-in stored for `email`. The first step of a sign-out, while
   * the session can still authorise a server-side revoke.
   */
  forgetStoredSignIn(email: string): Promise<void>;
}

/** What each step settles to when it fails: the session goes on without it. */
const NO_HOST_STEPS: SessionHost = {
  afterSignIn: () => {},
  postSignInGate: () => Promise.resolve(null),
  forgetStoredSignIn: () => Promise.resolve(),
};

const reportStep = (step: keyof SessionHost, error: unknown): void => {
  errorService.reportError(error, { operation: `sessionHost.${step}` });
};

// The executor runs synchronously, so a step that throws as it is called
// rejects here too; a bare `.catch` only sees a step that rejects later.
const settleStep = <T>(
  step: keyof SessionHost,
  run: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> =>
  new Promise<T>(resolve => resolve(run())).catch((error: unknown) => {
    reportStep(step, error);
    return fallback();
  });

const guarded = (steps: SessionHost): SessionHost => ({
  afterSignIn: () => {
    try {
      steps.afterSignIn();
    } catch (error) {
      reportStep('afterSignIn', error);
    }
  },
  postSignInGate: (user, email, offerRememberMe, signInToken) =>
    settleStep(
      'postSignInGate',
      () => steps.postSignInGate(user, email, offerRememberMe, signInToken),
      () =>
        NO_HOST_STEPS.postSignInGate(user, email, offerRememberMe, signInToken),
    ),
  forgetStoredSignIn: email =>
    settleStep(
      'forgetStoredSignIn',
      () => steps.forgetStoredSignIn(email),
      () => NO_HOST_STEPS.forgetStoredSignIn(email),
    ),
});

let host: SessionHost = NO_HOST_STEPS;

/**
 * Called once by the host's composition root, before the first sign-in. A step
 * that fails is reported and settles as a host without it would, so no host can
 * strand a sign-in or keep a person signed in.
 */
export const registerSessionHost = (steps: SessionHost): void => {
  host = guarded(steps);
};

export const sessionHost = (): SessionHost => host;
