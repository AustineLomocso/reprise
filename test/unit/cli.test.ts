// CLI: stubs exit 2 with the exact message; flags parse; help documents every command.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, COMMANDS, EXIT_NOT_IMPLEMENTED, type Io } from '../../src/commands.js';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  const x: Io = { out: (t) => out.push(t), err: (t) => err.push(t), env: {} };
  return { x, out, err };
}

const stubs: [string, string[]][] = [
  ['triage', ['--issue', '4']],
  ['fix', ['--issue', '4']],
  ['verify', ['--pr', '9']],
  ['run', ['--local', '--issue', '4', '--stage', 'triage']],
  ['publish', []],
  ['provider', []],
];

for (const [name, args] of stubs) {
  test(`${name} is a stub: exit 2 and the exact message`, async () => {
    const t = io();
    const code = await main([name, ...args, '--dry-run'], t.x);
    assert.equal(code, EXIT_NOT_IMPLEMENTED);
    assert.deepEqual(t.err, [`Not implemented in the web-only build: ${name}`]);
  });
  test(`${name} --help documents its flags and exits 0`, async () => {
    const t = io();
    assert.equal(await main([name, '--help'], t.x), 0);
    const help = t.out.join('\n');
    for (const a of args.filter((s) => s.startsWith('--'))) assert.ok(help.includes(a), `${name} help mentions ${a}`);
    assert.match(help, /--bob-replay DIR/);
    assert.match(help, /exits with code 2/);
  });
}

test('global flags parse on every command', async () => {
  const t = io();
  assert.equal(await main(['triage', '--issue=4', '--bob-replay', 'fx', '--bob-record=rec', '--dry-run'], t.x), 2);
});

test('flag errors exit 1 with a reason', async () => {
  const cases: [string[], RegExp][] = [
    [['triage'], /--issue is required/],
    [['triage', '--issue', 'abc'], /positive integer/],
    [['run', '--local', '--issue', '1', '--stage', 'deploy'], /one of triage, fix/],
    [['verify', '--pr', '3', '--force'], /unknown flag --force/],
    [['triage', '--issue', '1', '--issue', '2'], /more than once/],
    [['build-site', '--data', 'd', '--out', 'o', '--data-source', 'demo'], /one of sample, live/],
    [['frobnicate'], /unknown command/],
  ];
  for (const [argv, re] of cases) {
    const t = io();
    assert.equal(await main(argv, t.x), 1, argv.join(' '));
    assert.match(t.err.join('\n'), re, argv.join(' '));
  }
});

test('top-level help lists every command', async () => {
  const t = io();
  assert.equal(await main(['--help'], t.x), 0);
  for (const c of COMMANDS) assert.ok(t.out.join('\n').includes(c.name));
});
