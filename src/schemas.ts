// JSON Schema validation for every data contract (schemas/*.schema.json, draft 2020-12).
// Schemas are imported as JSON so the bundled CLI carries them.

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import issueRecord from '../schemas/issue-record.schema.json' with { type: 'json' };
import siteIndex from '../schemas/site-index.schema.json' with { type: 'json' };
import repriseConfig from '../schemas/reprise-config.schema.json' with { type: 'json' };
import intake from '../schemas/intake.schema.json' with { type: 'json' };
import dedupeConfirm from '../schemas/dedupe-confirm.schema.json' with { type: 'json' };
import repro from '../schemas/repro.schema.json' with { type: 'json' };
import rootcause from '../schemas/rootcause.schema.json' with { type: 'json' };
import fix from '../schemas/fix.schema.json' with { type: 'json' };

export const SCHEMA_NAMES = [
  'issue-record', 'site-index', 'reprise-config', 'intake', 'dedupe-confirm', 'repro', 'rootcause', 'fix',
] as const;
export type SchemaName = (typeof SCHEMA_NAMES)[number];

const SOURCES: Record<SchemaName, object> = {
  'issue-record': issueRecord,
  'site-index': siteIndex,
  'reprise-config': repriseConfig,
  intake,
  'dedupe-confirm': dedupeConfirm,
  repro,
  rootcause,
  fix,
};

// ajv-formats is published as CommonJS; its default export arrives either directly or under .default.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as (ajv: Ajv2020) => Ajv2020;

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const compiled = new Map<SchemaName, ValidateFunction>();

function validator(name: SchemaName): ValidateFunction {
  let v = compiled.get(name);
  if (!v) {
    v = ajv.compile(SOURCES[name]);
    compiled.set(name, v);
  }
  return v;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function describe(e: ErrorObject): string {
  const where = e.instancePath === '' ? '(root)' : e.instancePath;
  const extra = e.keyword === 'additionalProperties' ? ` '${String(e.params['additionalProperty'])}'` : '';
  const allowed = e.keyword === 'enum' ? ` (${(e.params['allowedValues'] as unknown[]).map(String).join(', ')})` : '';
  return `${where} ${e.message ?? e.keyword}${extra}${allowed}`;
}

export function validate(name: SchemaName, data: unknown): ValidationResult {
  const v = validator(name);
  const valid = v(data) as boolean;
  return { valid, errors: valid ? [] : (v.errors ?? []).map(describe) };
}
