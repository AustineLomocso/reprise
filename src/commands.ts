// Command table, flag parsing and dispatch for the reprise CLI (entry point: src/cli.ts).
// Commands and flags: docs/kit/01-architecture/architecture.md "Engine commands".
// Web-only build: only build-site does anything; the other commands parse their flags,
// print "Not implemented in the web-only build: <command>" and exit 2.

import { runBuildSite } from './site/command.js';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_NOT_IMPLEMENTED = 2;

type FlagKind = 'boolean' | 'string' | 'positive-integer' | { choices: readonly string[] };

interface FlagSpec {
  name: string;
  kind: FlagKind;
  value?: string;
  help: string;
  required?: boolean;
  default?: string;
}

interface CommandSpec {
  name: string;
  summary: string;
  flags: FlagSpec[];
  implemented: boolean;
  details?: string;
}

const GLOBAL_FLAGS: FlagSpec[] = [
  { name: 'dry-run', kind: 'boolean', help: 'Make no writes to GitHub.' },
  { name: 'bob-replay', kind: 'string', value: 'DIR', help: 'Use recorded reasoning-provider responses from DIR (either provider).' },
  { name: 'bob-record', kind: 'string', value: 'DIR', help: 'Record reasoning-provider responses into DIR.' },
  { name: 'help', kind: 'boolean', help: 'Show help.' },
];

export const COMMANDS: CommandSpec[] = [
  {
    name: 'triage',
    summary: 'Intake, dedupe, environment, repro, trials, verdict and diagnosis for one issue.',
    flags: [{ name: 'issue', kind: 'positive-integer', value: 'N', help: 'Issue number.', required: true }],
    implemented: false,
  },
  {
    name: 'fix',
    summary: 'Propose a fix as a pull request, then verify it.',
    flags: [{ name: 'issue', kind: 'positive-integer', value: 'N', help: 'Issue number.', required: true }],
    implemented: false,
  },
  {
    name: 'verify',
    summary: 'Repro check and regression comparison on a pull request linked with "Fixes #N".',
    flags: [{ name: 'pr', kind: 'positive-integer', value: 'N', help: 'Pull request number.', required: true }],
    implemented: false,
  },
  {
    name: 'run',
    summary: 'Run a stage on a developer machine with a locally logged-in Bob Shell.',
    flags: [
      { name: 'local', kind: 'boolean', help: 'Run on this machine.', required: true },
      { name: 'issue', kind: 'positive-integer', value: 'N', help: 'Issue number.', required: true },
      { name: 'stage', kind: { choices: ['triage', 'fix'] }, value: 'triage|fix', help: 'Stage to run.', required: true },
    ],
    implemented: false,
  },
  {
    name: 'publish',
    summary: 'Commit the issue record to the reprise-data branch.',
    flags: [],
    implemented: false,
  },
  {
    name: 'provider',
    summary: 'Print the provider value from .reprise.yml (default claude).',
    flags: [],
    implemented: false,
  },
  {
    name: 'build-site',
    summary: 'Build the static dashboard from issue records.',
    flags: [
      { name: 'data', kind: 'string', value: 'DIR', help: 'Directory holding issues/<N>.json records.', required: true },
      { name: 'out', kind: 'string', value: 'DIR', help: 'Output directory for the site (replaced).', required: true },
      {
        name: 'data-source',
        kind: { choices: ['sample', 'live'] },
        value: 'sample|live',
        help: 'Written to data/index.json; "sample" shows the sample-data banner on every page (ADR-13).',
        default: 'live',
      },
    ],
    implemented: true,
    details:
      'The repository shown on the dashboard is the "repo" of the records; with no records it is\ntaken from GITHUB_REPOSITORY. The build fails if any record does not match\nschemas/issue-record.schema.json.',
  },
];

function flagLine(f: FlagSpec): string {
  const left = `  --${f.name}${f.value ? ` ${f.value}` : ''}`;
  const notes = [f.required ? 'required' : '', f.default ? `default ${f.default}` : ''].filter(Boolean).join(', ');
  return `${left.padEnd(30)}${f.help}${notes ? ` (${notes})` : ''}`;
}

export function mainHelp(): string {
  const lines = [
    'Usage: reprise <command> [flags]',
    '',
    'Commands:',
    ...COMMANDS.map((c) => `  ${c.name.padEnd(12)}${c.summary}${c.implemented ? '' : ' [not implemented in the web-only build]'}`),
    '',
    'Global flags:',
    ...GLOBAL_FLAGS.map(flagLine),
    '',
    'Run "reprise <command> --help" for the flags of one command.',
  ];
  return lines.join('\n');
}

export function commandHelp(c: CommandSpec): string {
  const lines = [
    `Usage: reprise ${c.name}${c.flags.map((f) => ` ${f.required ? '' : '['}--${f.name}${f.value ? ` ${f.value}` : ''}${f.required ? '' : ']'}`).join('')}`,
    '',
    c.summary,
  ];
  if (!c.implemented) lines.push('', 'Not implemented in the web-only build: this command exits with code 2.');
  if (c.details) lines.push('', c.details);
  if (c.flags.length) lines.push('', 'Flags:', ...c.flags.map(flagLine));
  lines.push('', 'Global flags:', ...GLOBAL_FLAGS.map(flagLine));
  return lines.join('\n');
}

export class UsageError extends Error {}

export type ParsedFlags = Record<string, string | boolean | number>;

/** Parse `--name value`, `--name=value` and boolean `--name` flags against the allowed specs. */
export function parseFlags(args: readonly string[], specs: readonly FlagSpec[]): ParsedFlags {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const out: ParsedFlags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '-h') {
      out['help'] = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument "${arg}"`);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const spec = byName.get(name);
    if (!spec) throw new UsageError(`unknown flag --${name}`);
    if (name in out) throw new UsageError(`--${name} given more than once`);
    if (spec.kind === 'boolean') {
      if (eq !== -1) throw new UsageError(`--${name} takes no value`);
      out[name] = true;
      continue;
    }
    let value: string | undefined;
    if (eq !== -1) value = arg.slice(eq + 1);
    else {
      value = args[i + 1];
      i++;
    }
    if (value === undefined || value === '' || (eq === -1 && value.startsWith('--'))) {
      throw new UsageError(`--${name} needs a value${spec.value ? ` (${spec.value})` : ''}`);
    }
    if (spec.kind === 'positive-integer') {
      if (!/^[1-9][0-9]*$/.test(value)) throw new UsageError(`--${name} must be a positive integer, got "${value}"`);
      out[name] = Number(value);
    } else if (typeof spec.kind === 'object') {
      if (!spec.kind.choices.includes(value)) {
        throw new UsageError(`--${name} must be one of ${spec.kind.choices.join(', ')}, got "${value}"`);
      }
      out[name] = value;
    } else {
      out[name] = value;
    }
  }
  if (!out['help']) {
    for (const s of specs) {
      if (s.required && !(s.name in out)) throw new UsageError(`--${s.name} is required`);
      if (s.default !== undefined && !(s.name in out)) out[s.name] = s.default;
    }
  }
  return out;
}

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
  env: Readonly<Record<string, string | undefined>>;
}

const defaultIo: Io = {
  out: (t) => process.stdout.write(`${t}\n`),
  err: (t) => process.stderr.write(`${t}\n`),
  env: process.env,
};

export async function main(argv: readonly string[], io: Io = defaultIo): Promise<number> {
  const [name, ...rest] = argv;
  if (name === undefined || name === '--help' || name === '-h' || name === 'help') {
    io.out(mainHelp());
    return name === undefined ? EXIT_ERROR : EXIT_OK;
  }
  const command = COMMANDS.find((c) => c.name === name);
  if (!command) {
    io.err(`reprise: unknown command "${name}"\n\n${mainHelp()}`);
    return EXIT_ERROR;
  }
  let flags: ParsedFlags;
  try {
    flags = parseFlags(rest, [...command.flags, ...GLOBAL_FLAGS]);
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`reprise ${command.name}: ${err.message}\n\n${commandHelp(command)}`);
      return EXIT_ERROR;
    }
    throw err;
  }
  if (flags['help']) {
    io.out(commandHelp(command));
    return EXIT_OK;
  }
  if (!command.implemented) {
    io.err(`Not implemented in the web-only build: ${command.name}`);
    return EXIT_NOT_IMPLEMENTED;
  }
  switch (command.name) {
    case 'build-site':
      return runBuildSite(
        { data: String(flags['data']), out: String(flags['out']), dataSource: flags['data-source'] as 'sample' | 'live' },
        io,
      );
    default:
      io.err(`reprise: no handler for ${command.name}`);
      return EXIT_ERROR;
  }
}
