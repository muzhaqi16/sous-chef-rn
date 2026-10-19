import type { LoginUserFragment } from '#operations/auth/userFragments.generated';

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
  /** Decided before auth state changes, so the gate and the session commit together. */
  postSignInGate(
    user: LoginUserFragment,
    email: string,
    offerRememberMe: boolean,
  ): Promise<PostSignInGate>;
  /**
   * Drops the sign-in stored for `email`. The first step of a sign-out, while
   * the session can still authorise a server-side revoke.
   */
  forgetStoredSignIn(email: string): Promise<void>;
}

const NO_HOST_STEPS: SessionHost = {
  afterSignIn: () => {},
  postSignInGate: () => Promise.resolve(null),
  forgetStoredSignIn: () => Promise.resolve(),
};

let host: SessionHost = NO_HOST_STEPS;

/** Called once by the host's composition root, before the first sign-in. */
export const registerSessionHost = (steps: SessionHost): void => {
  host = steps;
};

export const sessionHost = (): SessionHost => host;
