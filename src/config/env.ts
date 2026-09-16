import { RAW_ENV, type GeneratedEnv } from './env.generated';

/**
 * Build-time config as pure JS, injected by `scripts/generate-env.js`. Every
 * value is `string | undefined`; consumers apply their own parsing. A `KEY=`
 * line generates `''`, which means unset, so it arrives here as `undefined`.
 */
export const env: GeneratedEnv = Object.fromEntries(
  Object.entries(RAW_ENV).filter(([, value]) => value !== ''),
);

export type Env = GeneratedEnv;
