import { RAW_ENV, type GeneratedEnv } from './env.generated';

/**
 * Build-time config as pure JS, injected by `scripts/generate-env.js`. Every
 * value is `string | undefined`; consumers apply their own parsing.
 */
export const env: GeneratedEnv = RAW_ENV;

export type Env = GeneratedEnv;
