/**
 * Quiets the transports and offline queue on session end. A registry rather than
 * direct calls because importing both ways closes the cycle
 * `store → resetManager → apollo/client → links → store`; each Apollo module
 * registers its step at module init, pulled in by the link chain.
 */
import { logger } from '#/utils/environment';

type TeardownStep = () => void | Promise<void>;

const steps = new Map<string, TeardownStep>();

/** Registering the same name twice replaces the step; the last one wins. */
export const registerSessionTeardown = (
  name: string,
  step: TeardownStep,
): void => {
  steps.set(name, step);
};

/**
 * Run every registered step.
 *
 * One step failing must not skip the rest — they are independent, and a session
 * that ends half-quiet is the failure this exists to prevent.
 */
/**
 * Insertion order is first-USE order under Metro's `inlineRequires`, so it
 * differs between a fresh sign-in and a restored session.
 * `refresh-token-revoke` reads the tokens before anything else runs. A step not
 * named here runs after those that are.
 */
const TEARDOWN_ORDER: readonly string[] = [
  'refresh-token-revoke',
  'devicePushToken',
  'token-refresh',
  'notification-reseed',
  'offline-queue',
  'apollo',
];

export const runSessionTeardown = async (): Promise<void> => {
  const ordered = [
    ...TEARDOWN_ORDER.filter(name => steps.has(name)),
    ...[...steps.keys()].filter(name => !TEARDOWN_ORDER.includes(name)),
  ];

  for (const name of ordered) {
    const step = steps.get(name);
    if (!step) continue;
    try {
      await step();
    } catch (error) {
      logger.error(`Session teardown step "${name}" failed:`, error);
    }
  }
};

/** @internal Test seam: drop every registered step. */
export const clearSessionTeardown = (): void => {
  steps.clear();
};
