// Neon Coast Cover Studio — the hand-in program for gta6-cover-art-01 (Node 22,
// standard library only). It assembles /output from this repository: a verbatim copy
// of app/ (the offline cover maker) and screenshots/ (its own cover shots), plus a
// dossier.json written by the vendored make.fun library so the judge can read the
// entry. Nothing here reaches the network and nothing is installed to run it.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Start from a clean output directory so a stale file can never ride along.
mkdirSync(outputDir, { recursive: true });
rmSync(join(outputDir, 'app'), { recursive: true, force: true });
rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

// The gate's caps (reference/gate.json in the kit): the text cap shapes the dossier;
// the rest refuse an entry the scorer would refuse — too many screenshots, one over
// 256 KiB, or an app/ over 993 files / 48 MiB / a 1000-byte path. /output itself
// caps at 1000 entries and 64 MiB, which app/, screenshots/ and dossier.json share.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A one-line receipt on stdout, so a run that silently wrote nothing is obvious.
console.log(`neon-coast entry written to ${outputDir} (dossier ${dossier.length} bytes)`);
