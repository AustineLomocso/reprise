// The build-site command: reprise build-site --data DIR --out DIR [--data-source sample|live]

import { fileURLToPath } from 'node:url';
import type { Io } from '../commands.js';
import { buildSite, BuildSiteError } from './build-site.js';

export interface BuildSiteArgs {
  data: string;
  out: string;
  dataSource: 'sample' | 'live';
}

/** dashboard/ next to dist/ (the bundled CLI lives at dist/reprise.mjs). */
export function defaultAssetsDir(): string {
  return fileURLToPath(new URL('../dashboard/', import.meta.url));
}

export async function runBuildSite(args: BuildSiteArgs, io: Io, assetsDir: string = defaultAssetsDir()): Promise<number> {
  try {
    const { index, records } = await buildSite({
      dataDir: args.data,
      outDir: args.out,
      dataSource: args.dataSource,
      assetsDir,
      fallbackRepo: io.env['GITHUB_REPOSITORY'],
    });
    io.out(`Built ${args.out} from ${records} record(s) for ${index.repo} (data source: ${index.data_source}).`);
    return 0;
  } catch (err) {
    if (err instanceof BuildSiteError) {
      io.err(`reprise build-site: ${err.message}${err.details.length ? `\n  ${err.details.join('\n  ')}` : ''}`);
      return 1;
    }
    throw err;
  }
}
