/**
 * The work a session end has to do outside the store: quiet the transports and
 * the offline queue, so nothing keeps talking to a server that has already
 * refused these credentials.
 *
 * The steps live in the Apollo layer while `endSession` lives in the store, and
 * importing across that edge in both directions closes the cycle
 * `store → resetManager → apollo/client → links → store`. So each Apollo module
 * registers its own step here and the store calls the registry — the same
 * hand-off `registerApolloClient` and `registerTokenRefresh` use.
 *
 * Registration happens at module init and every registrant is pulled in by the
 * link chain, so the steps are in place before any session can end. A step that
 * never registered is simply absent; the store still clears.
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
