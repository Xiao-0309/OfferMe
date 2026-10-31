import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['.git', 'node_modules', 'out', 'release', 'dist', 'coverage', '.vite', 'native-build']);
const rules = [
  ['API secret', /\bsk-[A-Za-z0-9_.-]{32,}/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['personal absolute path', /\/(?:Users|home)\/[A-Za-z0-9_.-]+\//],
];
const findings = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const name = relative(root, path).replaceAll('\\', '/');
    if (skip.has(entry.name) || name === 'build/native') continue;
    if (entry.isSymbolicLink()) { findings.push(`${name}: unexpected symlink`); continue; }
    if (entry.isDirectory()) { walk(path); continue; }
    if (/^(?:\.env(?:\..*)?|settings\.json|sessions\.json|audio-routing\.json)$/.test(entry.name) && entry.name !== '.env.example') findings.push(`${name}: private configuration file`);
    const content = readFileSync(path);
    if (content.includes(0)) continue;
    content.toString('utf8').split('\n').forEach((line, index) => {
      for (const [rule, pattern] of rules) if (pattern.test(line)) findings.push(`${name}:${index + 1}: ${rule}`);
    });
  }
}
walk(root);
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log('Public source check passed: no matching secret/profile/path patterns.');
