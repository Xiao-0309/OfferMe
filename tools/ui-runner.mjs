/** Build test-only main-process services, then run an isolated, hidden Electron app. */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({
  entryPoints: ['electron/settings.ts', 'electron/llm/interview.ts', 'electron/services/documents.ts'],
  absWorkingDir: root, outdir: 'out/ui-test', outbase: 'electron', bundle: true,
  platform: 'node', format: 'cjs', packages: 'external', logLevel: 'warning',
});
const require = createRequire(import.meta.url);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(require('electron'), ['tools/ui-smoke.cjs', ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
