import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AudioRouteResult } from '../../shared/audioCapture';

interface RouteOptions {
  platform: string;
  packaged: boolean;
  resourceRoot: string;
  dataDirectory: string;
  isolated: boolean;
}

/** Reapply only a route the user explicitly configured with audio:setup. */
export function shouldConfigureAudioRoute(opts: RouteOptions, hasSavedRoute: boolean): boolean {
  return opts.platform === 'darwin' && opts.packaged && !opts.isolated && hasSavedRoute;
}

export function parseRouteResult(stdout: string): AudioRouteResult {
  try {
    const value = JSON.parse(stdout);
    if (typeof value.ok !== 'boolean' || typeof value.fingerprint !== 'string') throw new Error();
    return { managed: true, ok: value.ok, code: value.ok ? 'OK' :
      value.code === 'OUTPUT_DISCONNECTED' ? 'OUTPUT_DISCONNECTED' : 'OUTPUT_BYPASSES_BLACKHOLE',
      fingerprint: value.fingerprint };
  } catch {
    return { managed: true, ok: false, code: 'CHECK_FAILED' };
  }
}

let preparing: Promise<AudioRouteResult> | undefined;
export async function checkAudioRoute(opts: RouteOptions, prepare = false): Promise<AudioRouteResult> {
  if (!shouldConfigureAudioRoute(opts, existsSync(join(opts.dataDirectory, 'audio-routing.json')))) {
    return { managed: false, ok: true, code: 'OK' };
  }
  const helper = join(opts.resourceRoot, 'native', 'audio-route');
  if (!existsSync(helper)) return { managed: true, ok: false, code: 'CHECK_FAILED' };
  if (preparing) return preparing;
  const run = async (): Promise<AudioRouteResult> => {
    const exec = (action: string) => promisify(execFile)(helper, [action], {
      timeout: 15_000, env: { ...process.env, OFFERME_DATA_DIR: opts.dataDirectory },
    });
    try {
      if (prepare) {
        try { await exec('configure'); }
        catch { /* The read-only check below supplies a safe, actionable code. */ }
      }
      return parseRouteResult((await exec('check')).stdout);
    } catch { return { managed: true, ok: false, code: 'CHECK_FAILED' }; }
  };
  if (!prepare) return run();
  preparing = run();
  try { return await preparing; } finally { preparing = undefined; }
}

export async function configureAudioRoute(opts: RouteOptions): Promise<void> {
  const result = await checkAudioRoute(opts, true);
  if (!result.ok) console.warn('[audio-route] Saved route needs attention:', result.code);
}
