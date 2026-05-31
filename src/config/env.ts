import { RAW_ENV, type GeneratedEnv } from './env.generated';

/**
 * Build-time configuration, read as pure JS (no native module).
 *
 * Values are injected at build time by `scripts/generate-env.js`, which reads
 * the active env file (`.env` / `.env.<ENVFILE>`) and `process.env`. Every value
 * is `string | undefined`; consumers apply their own fallbacks/parsing.
 */
export const env: GeneratedEnv = RAW_ENV;

export type Env = GeneratedEnv;
