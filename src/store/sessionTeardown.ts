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
export const runSessionTeardown = async (): Promise<void> => {
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      logger.error(`Session teardown step "${name}" failed:`, error);
    }
  }
};

/** Test seam: drop every registered step. */
export const clearSessionTeardown = (): void => {
  steps.clear();
};
