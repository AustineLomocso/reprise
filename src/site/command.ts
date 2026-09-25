// build-site command. Implemented in step 2 of the web-only slice (docs/kit/PROGRESS.md).

import type { Io } from '../commands.js';

export interface BuildSiteArgs {
  data: string;
  out: string;
  dataSource: 'sample' | 'live';
}

export async function runBuildSite(_args: BuildSiteArgs, io: Io): Promise<number> {
  io.err('build-site is added in step 2 of the web-only slice');
  return 1;
}
