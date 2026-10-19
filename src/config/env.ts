import { requirePlatform } from '#platform/install';
import type { Env } from '#platform/ports';

/**
 * Build-time configuration, from the host's `environment` service. Every value
 * is a string or unset; consumers apply their own parsing.
 */
export const env: Env = requirePlatform('environment');
