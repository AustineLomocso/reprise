// Config loader: missing file, invalid schema, defaults applied (test-strategy.md "Config").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, ConfigError, DEFAULTS } from '../../src/config/index.js';

async function withFile(text: string | null, fn: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'reprise-config-'));
  const path = join(dir, '.reprise.yml');
  if (text !== null) await writeFile(path, text);
  try {
    await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('missing file is a ConfigError of kind missing, naming the file', async () => {
  await withFile(null, async (path) => {
    await assert.rejects(
      loadConfig(path),
      (e: unknown) => e instanceof ConfigError && e.kind === 'missing' && e.message.includes('.reprise.yml'),
    );
  });
});

test('schema violations are reported', async () => {
  await withFile('version: 1\nsandbox: {}\ntriage: { trials: 0 }\nprovider: gpt\n', async (path) => {
    await assert.rejects(loadConfig(path), (e: unknown) => {
      assert.ok(e instanceof ConfigError);
      assert.equal(e.kind, 'invalid');
      const all = e.details.join('\n');
      assert.match(all, /dockerfile/);
      assert.match(all, /trials/);
      assert.match(all, /provider/);
      return true;
    });
  });
});

test('unknown keys are rejected', async () => {
  await withFile('version: 1\nsandbox: { dockerfile: Dockerfile.reprise }\nsandbx: {}\n', async (path) => {
    await assert.rejects(
      loadConfig(path),
      (e: unknown) => e instanceof ConfigError && e.details.some((d) => d.includes("'sandbx'")),
    );
  });
});

test('invalid YAML is a ConfigError of kind invalid', async () => {
  await withFile('version: [1\n', async (path) => {
    await assert.rejects(loadConfig(path), (e: unknown) => e instanceof ConfigError && e.kind === 'invalid');
  });
});

test('defaults from architecture.md are applied; given values win', async () => {
  const yml = 'version: 1\nsandbox:\n  dockerfile: Dockerfile.reprise\ntriage:\n  trials: 30\nedit_scope:\n  fix: ["lib/**"]\n';
  await withFile(yml, async (path) => {
    const c = await loadConfig(path);
    assert.equal(c.sandbox.dockerfile, 'Dockerfile.reprise');
    assert.equal(c.sandbox.run_timeout_seconds, 60);
    assert.equal(c.triage.trials, 30);
    assert.equal(c.triage.max_repro_attempts, 3);
    assert.equal(c.triage.max_auto_retriage, 3);
    assert.equal(c.triage.bisect, true);
    assert.deepEqual(c.edit_scope.fix, ['lib/**']);
    assert.deepEqual(c.edit_scope.never, DEFAULTS.edit_scope.never);
    assert.equal(c.fix.max_iterations, 3);
    assert.deepEqual(c.verify, { min_runs: 3, max_runs: 200, regression_reruns: 3 });
    assert.equal(c.tests.report, 'junit');
    assert.equal(c.tests.repro_dir, 'test/reprise');
    assert.equal(c.provider, 'claude');
    assert.equal(c.claude.model, 'claude-sonnet-5');
    assert.equal(c.bob.max_turns.repro, 20);
  });
});

test('the architecture.md example validates and equals the defaults', async () => {
  const md = await readFile(new URL('../../../docs/kit/01-architecture/architecture.md', import.meta.url), 'utf8');
  const yml = /```yaml\n([\s\S]*?)```/.exec(md)![1]!;
  await withFile(yml, async (path) => {
    const c = await loadConfig(path);
    const { version: _v, sandbox, ...rest } = c;
    assert.equal(sandbox.run_timeout_seconds, DEFAULTS.sandbox.run_timeout_seconds);
    const { sandbox: _s, ...defaultRest } = DEFAULTS;
    assert.deepEqual(rest, defaultRest);
  });
});
