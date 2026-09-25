// Load and validate .reprise.yml, then apply defaults (architecture.md "Target repo contract").

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { validate } from '../schemas.js';
import { DEFAULTS, type RepriseConfig } from './defaults.js';

export type { RepriseConfig } from './defaults.js';
export { DEFAULTS } from './defaults.js';

export class ConfigError extends Error {
  constructor(
    readonly kind: 'missing' | 'invalid',
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Plain = Record<string, unknown>;

function isPlain(v: unknown): v is Plain {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep merge: plain objects merge key by key; arrays and scalars from `over` replace `base`. */
function merge(base: Plain, over: Plain): Plain {
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = isPlain(b) && isPlain(v) ? merge(b, v) : v;
  }
  return out;
}

/** Validate a parsed config object and return it with defaults applied. */
export function resolveConfig(raw: unknown, source = '.reprise.yml'): RepriseConfig {
  const result = validate('reprise-config', raw);
  if (!result.valid) {
    throw new ConfigError('invalid', `${source} does not match the config schema`, result.errors);
  }
  return merge(DEFAULTS as unknown as Plain, raw as Plain) as unknown as RepriseConfig;
}

/** Read, parse, validate and default the config file at `path`. */
export async function loadConfig(path: string): Promise<RepriseConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError('missing', `${path} is missing`);
    }
    throw err;
  }
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (err) {
    throw new ConfigError('invalid', `${path} is not valid YAML`, [(err as Error).message]);
  }
  return resolveConfig(raw, path);
}
