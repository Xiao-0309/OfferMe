import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') throw new Error('Audio routing setup is for macOS only.');
const action = process.argv[2];
if (!['configure', 'status', 'restore'].includes(action)) throw new Error('Use configure, status or restore.');
const result = spawnSync(fileURLToPath(new URL('../build/native/audio-route', import.meta.url)), [action], { stdio: 'inherit' });
if (result.error) console.error('Run npm run build:native first.', result.error.message);
process.exitCode = result.status ?? 1;
