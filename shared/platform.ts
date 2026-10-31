/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
export type CaptureKind = 'loopback' | 'input';

/** Electron's display-media loopback token is currently Windows-only. */
export function captureKindForPlatform(platform: string): CaptureKind {
  return platform === 'win32' ? 'loopback' : 'input';
}

/** Defaults apply only to newly created settings; saved user choices win. */
export function defaultHotkeysForPlatform(platform: string): { toggle: string; shot: string } {
  if (platform === 'darwin') {
    return { toggle: 'Command+B', shot: 'Command+Shift+S' };
  }
  return { toggle: 'Control+B', shot: 'Control+Shift+S' };
}
