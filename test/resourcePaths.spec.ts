/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { describe, expect, it } from 'vitest';
import { posix, win32 } from 'path';
import { resolveResourceRoot } from '../electron/resourcePaths';

// resolveResourceRoot is the pure half of getResourceRoot(); the electron
// import in that module stays inert here because we never touch `app`.
describe('resolveResourceRoot', () => {
  it('uses the repo root in development', () => {
    expect(resolveResourceRoot(false, 'C:\\ignored\\resources', 'C:\\repo\\OfferMe')).toBe(
      'C:\\repo\\OfferMe',
    );
  });

  it('uses resourcesPath when packaged (never the app.asar path)', () => {
    const appPath = 'C:\\Program Files\\OfferMe\\resources\\app.asar';
    const resourcesPath = 'C:\\Program Files\\OfferMe\\resources';
    expect(resolveResourceRoot(true, resourcesPath, appPath)).toBe(resourcesPath);
    expect(resolveResourceRoot(true, resourcesPath, appPath)).not.toContain('app.asar');
  });

  // the composed script path must match electron-builder.yml `extraResources`
  // (tools -> tools); joins are platform-pinned so the assertions hold on any
  // host running the suite
  it('resolves the packaged audio helper outside the asar archive', () => {
    const winRoot = resolveResourceRoot(
      true,
      'C:\\Program Files\\OfferMe\\resources',
      'C:\\Program Files\\OfferMe\\resources\\app.asar',
    );
    expect(win32.join(winRoot, 'native', 'audio-route')).toBe(
      'C:\\Program Files\\OfferMe\\resources\\native\\audio-route',
    );

    const macRoot = resolveResourceRoot(
      true,
      '/Applications/OfferMe.app/Contents/Resources',
      '/Applications/OfferMe.app/Contents/Resources/app.asar',
    );
    expect(posix.join(macRoot, 'native', 'audio-route')).toBe(
      '/Applications/OfferMe.app/Contents/Resources/native/audio-route',
    );
  });
});
