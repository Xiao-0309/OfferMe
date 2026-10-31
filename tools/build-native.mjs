import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform === 'darwin') {
  mkdirSync(new URL('../build/native/', import.meta.url), { recursive: true });
  const result = spawnSync('xcrun', ['swiftc', '-O', 'native/macos/audio-route.swift', '-o', 'build/native/audio-route'], { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
} else {
  console.log('The macOS audio route helper is not needed on this platform.');
}
