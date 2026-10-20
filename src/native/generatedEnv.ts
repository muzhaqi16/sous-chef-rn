import type { Env } from '#platform/ports';
import { RAW_ENV } from '#/config/env.generated';

/**
 * The build's configuration as `scripts/generate-env.js` wrote it. A `KEY=`
 * line generates `''`, which means unset, so it is dropped here and a consumer
 * falls back to its default.
 */
export const generatedEnv: Env = Object.fromEntries(
  Object.entries(RAW_ENV).filter(([, value]) => value !== ''),
);
